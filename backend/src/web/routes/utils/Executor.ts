/******************************************************************************
 * Executor.ts                                                                *
 *                                                                            *
 * Copyright (c) 2022 Robin Ferch                                             *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import { Request, Response } from 'express';

export type Executor = (request: Request, response: Response) => void;


