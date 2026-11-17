import fs from "fs";
import { Router } from "express";
import {
  updateLesson,
  deleteLesson,
  loadOwnedLesson,
  blockIfProcessing,
  uploadVideo,
  videoStatus,
} from "../controllers/lesson.controller.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { uploadVideoFile } from "../middleware/upload.js";
import path from "path";
import express from "express";
import { completeLesson } from "../controllers/lesson.controller.js";
import { canWatch } from "../middleware/access.js";
import { HLS_DIR } from "../config/paths.js";


const router = Router();
const teacher = allowRoles("instructor", "admin");
// Render free par disk reset hoti hai, to DB me "ready" hone par bhi files na hon
function hlsFilesExist(req, res, next) {
  const master = path.join(HLS_DIR, req.params.id, "master.m3u8");
  if (!fs.existsSync(master)) {
    return res.status(410).json({
      message: "This video is no longer on the server. The instructor needs to upload it again.",
      code: "VIDEO_FILES_MISSING",
    });
  }
  next();
}

router.put("/:id", protect, teacher, updateLesson);
router.delete("/:id", protect, teacher, deleteLesson);
// protected streaming: pehle login, phir enrollment check, phir file serve
router.use(
  "/:id/stream",
  protect,
  canWatch,
  (req, res, next) => express.static(path.join(HLS_DIR, req.params.id))(req, res, next)
);

router.post("/:id/complete", protect, completeLesson);
router.post(
  "/:id/video",
  protect,
  teacher,
  loadOwnedLesson,
  blockIfProcessing,
  uploadVideoFile.single("video"),
  uploadVideo
);
router.get("/:id/video/status", protect, teacher, loadOwnedLesson, videoStatus);

router.use(
  "/:id/stream",
  protect,
  canWatch,
  hlsFilesExist,
  (req, res, next) => express.static(path.join(HLS_DIR, req.params.id))(req, res, next)
);

export default router;