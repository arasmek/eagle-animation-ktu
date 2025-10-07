import dotenv from 'dotenv';
import fs from 'fs';
import { google } from 'googleapis';
import path from 'path';
dotenv.config();

// You need to set up OAuth2 credentials and token.json for Google Drive API
// See: https://developers.google.com/drive/api/v3/quickstart/nodejs

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

function loadCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

function loadToken() {
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
}

export async function uploadToDrive(filePath, fileName) {
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
  const folderId = arguments[2];
  const fileMetadata = folderId ? { name: fileName, parents: [folderId] } : { name: fileName };
  const media = { mimeType: 'video/mp4', body: fs.createReadStream(filePath) };

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
