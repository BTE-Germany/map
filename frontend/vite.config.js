import { sentryVitePlugin } from "@sentry/vite-plugin";
/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + vite.config.js                                                             +
 +                                                                            +
 + Copyright (c) 2023 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import importMetaEnv from "@import-meta-env/unplugin";


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    importMetaEnv.vite({ example: ".example.env" }),
    sentryVitePlugin({
      org: "btegermany",
      project: "map",
      url: "https://errors.dachstein.cloud/"
    })
  ],

  server: {
    proxy: {
      '/api': 'http://localhost:8899',
    }
  },

  build: {
    sourcemap: true
  }
})