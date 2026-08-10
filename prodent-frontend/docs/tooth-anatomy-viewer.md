# 3D-просмотрщик анатомии зуба

Отдельная страница доступна по адресу `/tooth-anatomy/`. Viewer написан на
TypeScript и Three.js без дополнительного UI-фреймворка и загружается отдельно
от основного кабинета.

## Быстрый запуск

```bash
npm install
npm run dev:viewer
```

Откройте `http://localhost:5173/tooth-anatomy/`.

Проверенный анатомический файл должен находиться в `public/models/tooth.glb`. Полный контракт
узлов, требования к геометрии и бюджет модели описаны в
`public/models/README.md`.

## Демонстрационный режим

Пока реального GLB нет, тестовый интерфейс можно открыть так:

```text
http://localhost:5173/tooth-anatomy/?model=mock
```

Этот режим показывает шесть простых прямоугольников и всегда помечается как
`ДЕМО-PLACEHOLDER — НЕ КЛИНИЧЕСКАЯ МОДЕЛЬ`. При ошибке production-модели viewer
не включает placeholder автоматически.

## Проверки

```bash
npm run lint:viewer
npm run typecheck:viewer
npm run test:viewer
npm run test:e2e
npm run build:viewer
```

Playwright использует mock-режим, SwiftShader и фиксированный pixel ratio, поэтому
CI не зависит от большого GLB. Эталонные изображения находятся рядом с
`tests/e2e/tooth-viewer.spec.ts`.

## Подготовка модели

```bash
npm run inspect:model
npm run optimize:model
```

Оптимизация сохраняет именованные анатомические узлы и не упрощает клиническую
геометрию автоматически. После неё стоматолог или медицинский 3D-специалист
должен повторно проверить все границы тканей.

Draco- и Basis/KTX2-декодеры копируются из установленной версии Three.js перед
`dev` и `build`. Meshopt загружается из того же пакета Three.js.
