"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const product_controller_1 = require("../controllers/product.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.authenticateJWT);
router.get("/", product_controller_1.getProducts);
router.post("/", product_controller_1.createProduct);
router.put("/:id", product_controller_1.updateProduct);
router.delete("/:id", product_controller_1.deleteProduct);
exports.default = router;
