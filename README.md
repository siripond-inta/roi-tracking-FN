# RoiTracking

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Running with Docker

`docker-compose.yml` and `Dockerfile` in this folder build the app (multi-stage Node build →
served as static files by nginx) and run it standalone:

```bash
docker compose up --build
```

Open http://localhost:4200 (override the host port with `FRONTEND_PORT` in the environment, e.g.
`FRONTEND_PORT=8081 docker compose up --build`).

The API base URL (`http://localhost:3000/api/...`) is hardcoded in
`src/app/services/*.service.ts` and resolved by the **browser**, not by this container, so it
keeps working as-is as long as the backend (`roi-tracking-BN`, run separately — see its own
`docker-compose.yml`) publishes port `3000` to the host.

This compose file declares `name: roi-tracking`, matching the backend's. They're still two
separate `docker compose up` commands (two separate repos), but Docker Desktop groups both
containers under one "roi-tracking" stack, and they share the same default Docker network.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
