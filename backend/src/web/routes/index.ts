import Web from '../Web';
import Router from './utils/Router';
import {RequestMethods} from './utils/RequestMethods';
import {Keycloak} from "keycloak-connect";
import RegionsController from "../../controllers/RegionsController";

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


        router.addRoute(RequestMethods.GET, "/region/all", async (request, response) => {
            await regionsController.getAllRegions(request, response);
        })

    }
}

export default Routes;
