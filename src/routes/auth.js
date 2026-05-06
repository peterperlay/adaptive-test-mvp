import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getPool } from "../db.js";

const router = express.Router();

export default router;