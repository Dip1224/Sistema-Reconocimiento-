import { Router } from "express";
import { login, changePassword } from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.post("/change-password", changePassword);

export default router;
