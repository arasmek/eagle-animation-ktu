import dotenv from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
import { app } from 'electron';
dotenv.config();

// You need to set up OAuth2 credentials and token.json for Google Drive API
// See: https://developers.google.com/drive/api/v3/quickstart/nodejs

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const userDataDir = app?.getPath('userData') || process.cwd();
const RESOURCES_DIR = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');

const resolvePath = (fileName) => {
  const userPath = path.join(userDataDir, fileName);
  if (fs.existsSync(userPath)) {
    return userPath;
  }
  const bundledPath = path.join(RESOURCES_DIR, fileName);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  return userPath;
};

const TOKEN_PATH = resolvePath('token.json');
const CREDENTIALS_PATH = resolvePath('credentials.json');

function loadCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function loadToken() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

export async function uploadToDrive(filePath, fileName, folderId, mimeType = 'video/mp4') {
  console.log(`[DRIVE] Attempting to upload: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    console.error(`[DRIVE] File does not exist: ${filePath}`);
    throw new Error('File to upload does not exist');
  }
  const credentials = loadCredentials();
  const token = loadToken();
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(token);

  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  const fileMetadata = folderId ? { name: fileName, parents: [folderId] } : { name: fileName };
  const media = { mimeType, body: fs.createReadStream(filePath) };

  try {
    const file = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
    const fileId = file.data.id;
    // Make file shareable
    await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
    const link = `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`[DRIVE] Upload successful: ${link}`);
    return link;
  } catch (err) {
    console.error('[DRIVE] Upload error:', err);
    throw err;
  }
}
