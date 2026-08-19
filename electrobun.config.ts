import type { ElectrobunConfig } from "electrobun/bun";

export default {
  app: {
    name: "SyncTable",
    identifier: "com.synctable.app",
    version: "0.1.0",
    description: "Cross-browser tree backup and workspace synchronization utility",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: {
      "src/mainview/index.html": "views/mainview/index.html",
      "src/mainview/style.css": "views/mainview/style.css",
      "docs/poster.jpeg": "views/mainview/assets/poster.jpeg",
      "src/native/bin/dia-db-reader": "bin/dia-db-reader",
    },
    mac: {
      defaultRenderer: "native",
    },
  },
} satisfies ElectrobunConfig;
