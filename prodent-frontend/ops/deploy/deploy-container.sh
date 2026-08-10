#!/bin/sh
set -eu
set +x

if [ "$#" -ne 11 ]; then
  echo "usage: deploy-container.sh KIND IMAGE EXPECTED_REVISION SERVICE HOST_BIND HOST_PORT ENV_FILE NETWORK UPLOADS_VOLUME RUN_ID DOCKER_CONFIG_DIR" >&2
  exit 64
fi

kind=$1
image=$2
expected_revision=$3
service=$4
host_bind=$5
host_port=$6
env_file=$7
network=$8
uploads_volume=$9
run_id=${10}
docker_config_dir=${11}

case "$kind" in
  backend) container_port=8080; health_attempts=90 ;;
  frontend) container_port=8080; health_attempts=60 ;;
  *) echo "unsupported service kind: $kind" >&2; exit 64 ;;
esac

validate_safe() {
  label=$1
  value=$2
  if [ -z "$value" ] || ! printf '%s' "$value" | LC_ALL=C grep -Eq '^[A-Za-z0-9._/@:-]+$'; then
    echo "$label contains unsupported characters or is empty" >&2
    exit 64
  fi
}

validate_safe image "$image"
validate_safe expected_revision "$expected_revision"
validate_safe service "$service"
validate_safe host_bind "$host_bind"
validate_safe host_port "$host_port"
validate_safe network "$network"
validate_safe run_id "$run_id"
validate_safe docker_config_dir "$docker_config_dir"

case "$image" in
  *@sha256:*) image_digest=${image##*@sha256:} ;;
  *) echo "refusing mutable image; repository@sha256:digest is required" >&2; exit 64 ;;
esac
if ! printf '%s' "$image_digest" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$'; then
  echo "refusing invalid image digest" >&2
  exit 64
fi
if ! printf '%s' "$expected_revision" | LC_ALL=C grep -Eq '^[0-9a-f]{40}$'; then
  echo "expected revision must be the full commit SHA" >&2
  exit 64
fi

if [ "$kind" = backend ]; then
  validate_safe env_file "$env_file"
  validate_safe uploads_volume "$uploads_volume"
  if [ ! -f "$env_file" ]; then
    echo "backend environment file does not exist: $env_file" >&2
    exit 66
  fi
fi

export DOCKER_CONFIG="$docker_config_dir"
candidate="${service}-candidate-${run_id}"
rollback="${service}-rollback"

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

show_diagnostics() {
  name=$1
  echo "diagnostics for $name" >&2
  docker container inspect "$name" --format '{{json .State}}' >&2 2>/dev/null || true
  docker container logs --tail 120 "$name" >&2 2>/dev/null || true
}

wait_healthy() {
  name=$1
  attempt=1
  while [ "$attempt" -le "$health_attempts" ]; do
    status=$(docker container inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || printf 'missing')
    case "$status" in
      healthy) echo "$name is healthy"; return 0 ;;
      unhealthy) echo "$name became unhealthy" >&2; show_diagnostics "$name"; return 1 ;;
      missing)
        state=$(docker container inspect "$name" --format '{{.State.Status}}' 2>/dev/null || printf 'missing')
        if [ "$state" = exited ] || [ "$state" = dead ] || [ "$state" = missing ]; then
          echo "$name stopped before becoming healthy" >&2
          show_diagnostics "$name"
          return 1
        fi
        ;;
    esac
    sleep 2
    attempt=$((attempt + 1))
  done
  echo "$name did not become healthy in time" >&2
  show_diagnostics "$name"
  return 1
}

run_container() {
  name=$1
  restart_policy=$2
  publish=$3
  set -- docker run -d --name "$name" --network "$network" --restart "$restart_policy" \
    --label "prodent.release.image=$image" --label "prodent.release.kind=$kind"
  if [ "$publish" = yes ]; then
    set -- "$@" --publish "${host_bind}:${host_port}:${container_port}"
  fi
  if [ "$kind" = backend ]; then
    set -- "$@" --env-file "$env_file" --mount "type=volume,source=${uploads_volume},target=/app/uploads"
  fi
  set -- "$@" "$image"
  "$@" >/dev/null
  for legacy_network in $legacy_networks; do
    if [ "$legacy_network" != "$network" ]; then docker network connect "$legacy_network" "$name"; fi
  done
}

restore_previous() {
  echo "new release failed; starting automatic rollback" >&2
  if container_exists "$service"; then docker container rm -f "$service" >/dev/null 2>&1 || true; fi
  if ! container_exists "$rollback"; then
    echo "rollback is impossible: there was no previous container" >&2
    return 1
  fi
  docker container rename "$rollback" "$service"
  docker container start "$service" >/dev/null
  if wait_healthy "$service"; then echo "automatic rollback completed" >&2; return 0; fi
  echo "automatic rollback container is also unhealthy" >&2
  return 1
}

cleanup_candidate() {
  if container_exists "$candidate"; then docker container rm -f "$candidate" >/dev/null 2>&1 || true; fi
}
trap cleanup_candidate EXIT HUP INT TERM

if [ "${ROLLBACK_ONLY:-no}" = yes ]; then
  restore_previous
  exit $?
fi

docker pull "$image" >/dev/null
actual_revision=$(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
if [ "$actual_revision" != "$expected_revision" ]; then
  echo "image revision mismatch: expected=$expected_revision actual=$actual_revision" >&2
  exit 65
fi
docker network inspect "$network" >/dev/null 2>&1 || docker network create "$network" >/dev/null

legacy_networks=''
if container_exists "$service"; then
  legacy_networks=$(docker container inspect "$service" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}')
fi

if [ "$kind" = backend ]; then
  if container_exists "$service"; then
    current_uploads=$(docker container inspect "$service" --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}')
    if [ -z "$current_uploads" ]; then
      echo "refusing deployment: current backend has no named /app/uploads volume" >&2
      exit 65
    fi
    if [ "$current_uploads" != "$uploads_volume" ]; then
      echo "refusing upload volume change: current=$current_uploads requested=$uploads_volume" >&2
      exit 65
    fi
  fi
  docker volume inspect "$uploads_volume" >/dev/null 2>&1 || docker volume create "$uploads_volume" >/dev/null
fi

cleanup_candidate
echo "starting isolated candidate $candidate"
run_container "$candidate" no no
wait_healthy "$candidate"
docker container rm -f "$candidate" >/dev/null

if container_exists "$rollback"; then docker container rm -f "$rollback" >/dev/null; fi

had_previous=no
if container_exists "$service"; then
  had_previous=yes
  docker container stop --time 30 "$service" >/dev/null
  docker container rename "$service" "$rollback"
fi

echo "promoting $image to $service"
if ! run_container "$service" unless-stopped yes; then
  [ "$had_previous" = yes ] && restore_previous || true
  exit 1
fi

if ! wait_healthy "$service"; then
  [ "$had_previous" = yes ] && restore_previous || docker container rm -f "$service" >/dev/null 2>&1 || true
  exit 1
fi

trap - EXIT HUP INT TERM
echo "deployment completed: service=$service image=$image"
