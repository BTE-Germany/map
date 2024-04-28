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
  plugins: [react(), importMetaEnv.vite({ example: ".example.env" })],
  server: {
    proxy: {
      '/api': 'http://localhost:8899',
    }
  }
})
