const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET || 'angelcontent';

app.use(express.static('public'));
app.use(express.json());

// List all videos
app.get('/api/videos', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET });
    const data = await s3.send(command);
    const files = (data.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified
    }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    const file = req.file;
    const key = `${Date.now()}-${file.originalname}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    await s3.send(command);
    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get download URL
app.get('/api/download/:key', async (req, res) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: decodeURIComponent(req.params.key)
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video
app.delete('/api/delete/:key', async (req, res) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: decodeURIComponent(req.params.key)
    });
    await s3.send(command);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
