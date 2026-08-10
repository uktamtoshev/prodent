#!/bin/sh
set -eu
set +x

required='SSH_PRIVATE_KEY_PATH SSH_KNOWN_HOSTS_PATH SSH_USER SERVER_HOST REGISTRY REGISTRY_USER REGISTRY_PASSWORD IMAGE EXPECTED_REVISION SERVICE_KIND SERVICE_NAME HOST_BIND HOST_PORT ENV_FILE NETWORK UPLOADS_VOLUME DEPLOY_RUN_ID SMOKE_URL'
for variable_name in $required; do
  eval "variable_value=\${$variable_name-}"
  if [ -z "$variable_value" ]; then
    echo "required deployment variable is empty: $variable_name" >&2
    exit 64
  fi
done

SSH_PORT=${SSH_PORT:-22}
if [ ! -f "$SSH_PRIVATE_KEY_PATH" ] || [ ! -f "$SSH_KNOWN_HOSTS_PATH" ]; then
  echo "SSH identity or known_hosts file is missing" >&2
  exit 66
fi

validate_remote_value() {
  label=$1
  value=$2
  if ! printf '%s' "$value" | LC_ALL=C grep -Eq '^[A-Za-z0-9._/@:-]+$'; then
    echo "$label contains unsupported characters" >&2
    exit 64
  fi
}

for pair in \
  "SSH_USER:$SSH_USER" "SERVER_HOST:$SERVER_HOST" "SSH_PORT:$SSH_PORT" \
  "REGISTRY:$REGISTRY" "REGISTRY_USER:$REGISTRY_USER" "IMAGE:$IMAGE" \
  "EXPECTED_REVISION:$EXPECTED_REVISION" \
  "SERVICE_KIND:$SERVICE_KIND" "SERVICE_NAME:$SERVICE_NAME" \
  "HOST_BIND:$HOST_BIND" "HOST_PORT:$HOST_PORT" "ENV_FILE:$ENV_FILE" \
  "NETWORK:$NETWORK" "UPLOADS_VOLUME:$UPLOADS_VOLUME" "DEPLOY_RUN_ID:$DEPLOY_RUN_ID" \
  "SMOKE_URL:$SMOKE_URL"
do
  validate_remote_value "${pair%%:*}" "${pair#*:}"
done

ssh_target="${SSH_USER}@${SERVER_HOST}"
remote_script="/tmp/prodent-deploy-${DEPLOY_RUN_ID}.sh"
remote_docker_config="/tmp/prodent-docker-${DEPLOY_RUN_ID}"

ssh_exec() {
  ssh -i "$SSH_PRIVATE_KEY_PATH" -p "$SSH_PORT" \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="$SSH_KNOWN_HOSTS_PATH" -o ConnectTimeout=15 \
    "$ssh_target" "$@"
}

cleanup_remote() {
  ssh_exec "DOCKER_CONFIG=${remote_docker_config} docker logout ${REGISTRY} >/dev/null 2>&1 || true; rm -f ${remote_script} ${remote_docker_config}/config.json; rmdir ${remote_docker_config} 2>/dev/null || true" || true
}
trap cleanup_remote EXIT
trap 'exit 130' HUP INT TERM

scp -q -i "$SSH_PRIVATE_KEY_PATH" -P "$SSH_PORT" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$SSH_KNOWN_HOSTS_PATH" -o ConnectTimeout=15 \
  ops/deploy/deploy-container.sh "${ssh_target}:${remote_script}"

ssh_exec "install -d -m 700 ${remote_docker_config} && chmod 700 ${remote_script}"
printf '%s' "$REGISTRY_PASSWORD" | ssh_exec \
  "DOCKER_CONFIG=${remote_docker_config} docker login ${REGISTRY} --username ${REGISTRY_USER} --password-stdin"

set +e
ssh_exec "/bin/sh ${remote_script} ${SERVICE_KIND} ${IMAGE} ${EXPECTED_REVISION} ${SERVICE_NAME} ${HOST_BIND} ${HOST_PORT} ${ENV_FILE} ${NETWORK} ${UPLOADS_VOLUME} ${DEPLOY_RUN_ID} ${remote_docker_config}"
deploy_status=$?
set -e

if [ "$deploy_status" -eq 0 ]; then
  smoke_base=${SMOKE_URL%/}
  case "$SERVICE_KIND" in
    backend) smoke_endpoint="${smoke_base}/actuator/health" ;;
    frontend) smoke_endpoint="${smoke_base}/api/v1/data/countries?select=id&limit=1" ;;
  esac
  if ! curl --fail --silent --show-error --retry 5 --retry-all-errors \
      --connect-timeout 10 --max-time 30 "$smoke_endpoint" >/dev/null; then
    echo "external smoke check failed; rolling back" >&2
    set +e
    ssh_exec "ROLLBACK_ONLY=yes /bin/sh ${remote_script} ${SERVICE_KIND} ${IMAGE} ${EXPECTED_REVISION} ${SERVICE_NAME} ${HOST_BIND} ${HOST_PORT} ${ENV_FILE} ${NETWORK} ${UPLOADS_VOLUME} ${DEPLOY_RUN_ID} ${remote_docker_config}"
    rollback_status=$?
    set -e
    if [ "$rollback_status" -ne 0 ]; then
      echo "automatic rollback after external smoke failure also failed" >&2
    fi
    deploy_status=1
  fi
fi

exit "$deploy_status"
