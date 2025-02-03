const express = require('express');
const { renderMain, renderRoom,
        createRoom, enterRoom,
        removeRoom, sendChat,
        sendGif, sendWhisper,
        kickUser, delegateUser,
     } = require('../controllers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/', renderMain);
router.get('/room', renderRoom);
router.post('/room', createRoom);
router.get('/room/:id', enterRoom);
// router.delete('/room/:id', removeRoom);
router.post('/room/:id/whisper', sendWhisper);
router.post('/room/:id/chat', sendChat);
router.post('/room/:id/kickUser', kickUser);
router.post('/room/:id/delegateUser', delegateUser);
try {
    fs.readdirSync('uploads');
} catch (error) {
    console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
    fs.mkdirSync('uploads');
}

const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, done) {
            // 요청 URL의 :id (roomId) 추출 (Express 라우트에서 /room/:id/gif 등으로 받는다고 가정)
            const roomId = req.params.id; 
            // roomId별 디렉토리 생성 경로
            const dir = path.join(__dirname, '..', 'uploads', roomId);

            // 디렉토리가 없으면 생성
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            done(null, dir);
        },
        filename(req, file, done) {
            const ext = path.extname(file.originalname);
            done(null, path.basename(file.originalname, ext) + Date.now() + ext);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
});
router.post('/room/:id/gif', upload.single('gif'), sendGif);

module.exports = router;