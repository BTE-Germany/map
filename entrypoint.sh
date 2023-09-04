#!/bin/sh

#
# entrypoint.sh
#
# Copyright (c) 2023 Robin Ferch
# https://robinferch.me
# This project is released under the MIT license.
#

cd /app/frontend || exit
npm i -D @import-meta-env/cli
npx import-meta-env -x .env

cd /app/backend || exit
npm run start
