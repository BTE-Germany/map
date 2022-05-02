import Core from "../Core";

class AccountLinkController {
    private core: Core;

    constructor(core: Core) {
        this.core = core;
    }

    public async handleAccountLink(req, res) {
        res.send("Account Linked");
    }
}
