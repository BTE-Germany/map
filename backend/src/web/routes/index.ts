/******************************************************************************
 * index.ts                                                                   *
 *                                                                            *
 * Copyright (c) 2022-2023 Robin Ferch                                        *
 * https://robinferch.me                                                      *
 * This project is released under the MIT license.                            *
 ******************************************************************************/

import Web from '../Web.js';
import Router from './utils/Router.js';
import { RequestMethods } from './utils/RequestMethods.js';
import { Keycloak } from "keycloak-connect";
import RegionsController from "../../controllers/RegionsController.js";
import { body, query } from "express-validator";
import checkNewUser from "./utils/CheckNewUserMiddleware.js";
import UserController from "../../controllers/UserController.js";
import AdminController from "../../controllers/AdminController.js";
import StatsController from "../../controllers/StatsController.js";
import InteractiveBuildingsController from "../../controllers/InteractiveBuildingsController.js";

class Routes {
    app;

    web: Web;

    keycloak: Keycloak;

    constructor(web: Web) {
        web.getCore().getLogger().info('Registering API routes');
        this.web = web;
        this.app = web.getApp();
        this.keycloak = this.web.getKeycloak();
        this.registerRoutes();

    }

    private registerRoutes() {
        const router: Router = new Router(this.web, "v1");

        const regionsController: RegionsController = new RegionsController(this.web.getCore());
        const userController: UserController = new UserController(this.web.getCore());
        const adminController: AdminController = new AdminController(this.web.getCore());
        const statsController: StatsController = new StatsController(this.web.getCore());
        const interactiveBuildingsController: InteractiveBuildingsController = new InteractiveBuildingsController(this.web.getCore());


        router.addRoute(RequestMethods.GET, "/region/all", async (request, response) => {
            await regionsController.getAllRegions(request, response);
        })

        router.addRoute(RequestMethods.GET, "/region/all/geojson", async (request, response) => {
            await regionsController.getAllRegionsAsGeoJSON(request, response);
        })

        router.addRoute(RequestMethods.GET, "/region/:id", async (request, response) => {
            await regionsController.getOneRegion(request, response);
        })

        router.addRoute(RequestMethods.DELETE, "/region/:id", async (request, response) => {
            await regionsController.deleteRegion(request, response);
        }, this.keycloak.protect()),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore())

        router.addRoute(RequestMethods.POST, "/region/:id/edit", async (request, response) => {
            await regionsController.editRegion(request, response);
        }, this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))

        router.addRoute(RequestMethods.POST, "/region/:id/report", async (request, response) => {
            await regionsController.reportRegion(request, response);
        },
            this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()),
            body('reason').isString(),
            body('comment').isString().isLength({ min: 50 }))

        router.addRoute(RequestMethods.POST, "/region/:id/additionalBuilder", async (request, response) => {
            await regionsController.addAdditionalBuilder(request, response);
        },
            this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()),
            body('username').isString())


        router.addRoute(RequestMethods.DELETE, "/region/:id/additionalBuilder/:builderId", async (request, response) => {
            await regionsController.removeAdditionalBuilder(request, response);
        },
            this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()));


        router.addRoute(RequestMethods.GET, "/region/:id/calculateBuildings", async (request, response) => {
            await regionsController.handleCalculateBuildings(request, response);
        })

        router.addRoute(RequestMethods.PUT, "/region/:id/image/upload", async (request, response) => {
            await regionsController.handleImageUpload(request, response);
        }, this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))

        router.addRoute(RequestMethods.DELETE, "/region/:id/image/:imageId", async (request, response) => {
            await regionsController.handleImageDelete(request, response);
        }, this.keycloak.protect(),
            checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))


        router.addRoute(RequestMethods.GET, "/user/@me", async (request, response) => {
            await userController.getCurrentUser(request, response);
        }, this.keycloak.protect(), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))

        router.addRoute(RequestMethods.POST, "/user/link", async (request, response) => {
            await userController.linkUser(request, response);
        }, this.keycloak.protect(), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('code').isString())

        router.addRoute(RequestMethods.POST, "/user/unlink", async (request, response) => {
            await userController.unlinkUser(request, response);
        }, this.keycloak.protect(), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))

        router.addRoute(RequestMethods.POST, "/user/teleport", async (request, response) => {
            await userController.teleportTo(request, response);
        }, this.keycloak.protect(), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('coords').isArray({
            max: 2,
            min: 2
        }))
        router.addRoute(RequestMethods.GET, "/user/:id/regions", async (request, response) => {
            await regionsController.getAllRegionsfromUser(request, response);
        }), query('id').isInt({ min: 0 })
        router.addRoute(RequestMethods.GET, "/user/:id/stats", async (request, response) => {
            await statsController.getUserStats(request, response);
        }), query('id').isInt({ min: 0 }), query('page').isInt({ min: 0 })

        router.addRoute(RequestMethods.GET, "/admin/user/@list", async (request, response) => {
            await adminController.getAllUsers(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()))

        router.addRoute(RequestMethods.POST, "/admin/user/@lock", async (request, response) => {
            await adminController.lockUser(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())

        router.addRoute(RequestMethods.POST, "/admin/user/@unlock", async (request, response) => {
            await adminController.unlockUser(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())

        router.addRoute(RequestMethods.GET, "/admin/recalculateBuildings", async (request, response) => {
            await adminController.calculateAllBuildings(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())

        router.addRoute(RequestMethods.GET, "/admin/calculateProgress", async (request, response) => {
            await adminController.getCalculationProgress(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())

        router.addRoute(RequestMethods.GET, "/admin/getOsmDisplayNames", async (request, response) => {
            await adminController.getOsmDisplayNames(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())

        router.addRoute(RequestMethods.GET, "/admin/osmDisplayNameProgress", async (request, response) => {
            await adminController.getOsmDisplayNameProgress(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())


        router.addRoute(RequestMethods.GET, "/admin/syncWithSearchDB", async (request, response) => {
            await adminController.syncWithSearchDB(request, response);
        }, this.keycloak.protect("realm:mapadmin"), checkNewUser(this.web.getCore().getPrisma(), this.web.getCore()), body('userId').isString())


        router.addRoute(RequestMethods.GET, "/stats/general", async (request, response) => {
            await statsController.getGeneralStats(request, response);
        })
        router.addRoute(RequestMethods.GET, "/stats/leaderboard", async (request, response) => {
            await statsController.getLeaderboard(request, response);
        }, query('page').isInt({ min: 0 }))


        router.addRoute(RequestMethods.GET, "/interactiveBuildings/all", async (request, response) => {
            await interactiveBuildingsController.getAllBuildings(request, response);
        })


    }
}

export default Routes;
