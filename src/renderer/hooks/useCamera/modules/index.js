import { isBlink } from '@common/isBlink';
import { DEVICE } from '@config-web';

import { Camera as NativeProxyCamera, CameraBrowser as NativeProxyBrowser } from './NativeProxy';
import { Camera as WebcamCamera, CameraBrowser as WebcamCameraBrowser } from './Webcam';
import { Camera as WebGPhoto2Camera, CameraBrowser as WebGPhoto2CameraBrowser } from './WebGPhoto2';

const Cameras = [
  { browser: WebcamCameraBrowser, item: WebcamCamera },
  ...(DEVICE === 'ELECTRON' ? [{ browser: NativeProxyBrowser, item: NativeProxyCamera }] : []),
  ...(DEVICE === 'WEB' && isBlink() ? [{ browser: WebGPhoto2CameraBrowser, item: WebGPhoto2Camera }] : []),
];

let cachedCameras = {};
let cachedAvailableCameras = [];

export const getCameras = async () => {
  const availableCameras = [];

  for (const camType of Cameras) {
    const cameras = (await camType?.browser?.getCameras()) || [];
    for (const camera of cameras) {
      availableCameras.push({
        ...camera,
        id: `${camera.type}-${camera.module}-${camera.deviceId}`,
        entityClass: camType?.item || null,
      });
    }
  }

  cachedAvailableCameras = availableCameras;
  return availableCameras;
};

export const getCamera = (id) => {
  if (cachedCameras[id]) {
    return cachedCameras[id];
  }

  const cameras = cachedAvailableCameras || [];

  for (const camera of cameras) {
    if (id === camera.id) {
      const CameraClass = camera?.entityClass;
      cachedCameras[id] = new CameraClass(camera.deviceId, camera);
      return cachedCameras[id];
    }
  }

  return null;
};

const convertBufferToCanvas = (buffer, type = 'image/jpeg') =>
  new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type });
    const url = URL.createObjectURL(blob);
    const imgObj = new Image();

    imgObj.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    imgObj.onload = function () {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.height = this.naturalHeight;
      tmpCanvas.width = this.naturalWidth;
      const ctx = tmpCanvas.getContext('2d', { alpha: false });
      ctx.drawImage(imgObj, 0, 0, this.naturalWidth, this.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(tmpCanvas);
    };
    imgObj.src = url;
  });

// "pictures" can be Canvas or Buffer
const mergePictures = async (pictures = []) => {
  const imageData = [];

  // Convert each picture to ImageData
  for (const pictData of pictures) {
    let canvas = pictData;

    if (!(pictData instanceof HTMLCanvasElement)) {
      canvas = await convertBufferToCanvas(pictData);
    }

    imageData.push({
      width: canvas.width,
      height: canvas.height,
      data: canvas.getContext('2d', { alpha: false }).getImageData(0, 0, canvas.width, canvas.height).data,
    });
  }

  // Control if all images have the same size
  if (new Set(imageData.map((e) => e.width)).length > 1 || new Set(imageData.map((e) => e.height)).length > 1) {
    throw new Error('MERGE_SIZE_INCONSISTENCIES');
  }

  // Define final width and height
  const width = imageData[0].width;
  const height = imageData[0].height;

  const nbImageData = imageData.length;
  const dataArray = new Uint8ClampedArray(width * height * 4);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const redIdx = y * (width * 4) + x * 4;
      const greenIdx = y * (width * 4) + x * 4 + 1;
      const blueIdx = y * (width * 4) + x * 4 + 2;
      const alphaIdx = y * (width * 4) + x * 4 + 3;

      let redValue = 0;
      let greenValue = 0;
      let blueValue = 0;

      for (let i = 0; i < nbImageData; i++) {
        redValue += imageData[i].data[redIdx];
        greenValue += imageData[i].data[greenIdx];
        blueValue += imageData[i].data[blueIdx];
      }
      dataArray[redIdx] = ~~(redValue / nbImageData);
      dataArray[greenIdx] = ~~(greenValue / nbImageData);
      dataArray[blueIdx] = ~~(blueValue / nbImageData);
      dataArray[alphaIdx] = 255;
    }
  }

  const imgValues = new ImageData(dataArray, width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.putImageData(imgValues, 0, 0, 0, 0, width, height);

  return canvas;
};

const reversePicture = async (picture, reverseX = false, reverseY = false) => {
  let canvas = picture;
  if (!(canvas instanceof HTMLCanvasElement)) {
    canvas = await convertBufferToCanvas(canvas);
  }

  if (!reverseX && !reverseY) {
    return canvas;
  }

  const width = canvas.width;
  const height = canvas.height;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d', { alpha: false });

  ctx.save();
  ctx.scale(reverseX ? -1 : 1, reverseY ? -1 : 1);
  ctx.drawImage(canvas, reverseX ? -width : 0, reverseY ? -height : 0, width, height);
  ctx.restore();

  return outputCanvas;
};

const canvasToArrayBuffer = (canvas) =>
  new Promise((resolve) => {
    canvas?.toBlob(
      async (blob) => {
        return resolve(Buffer.from(await blob.arrayBuffer()));
      },
      `image/png`,
      1
    );
  });

export const takePicture = async (camera, nbFramesToTake = 1, reverseX = true, reverseY = false) => {
  // eslint-disable-line no-async-promise-executor
  const bufferList = [];

  // Take pictures
  for (let i = 0; i < nbFramesToTake || i < 1; i++) {
    const data = await camera.takePicture();
    if (data) {
      bufferList.push(data);
    }
  }

  // Merge frames
  let finalCanvas = bufferList.length > 1 ? { type: 'image/png', buffer: await mergePictures(bufferList.map((e) => e?.buffer)) } : bufferList?.[0];

  if (!finalCanvas) {
    return { type: null, buffer: null };
  }

  // Reverse frame
  if (reverseX || reverseY) {
    finalCanvas = { type: 'image/png', buffer: await reversePicture(finalCanvas.buffer, reverseX, reverseY) };
  }

  let outputBuffer = finalCanvas.buffer;
  if (outputBuffer instanceof HTMLCanvasElement) {
    outputBuffer = await canvasToArrayBuffer(outputBuffer);
  }
  if (Buffer?.isBuffer?.(outputBuffer)) {
    // no-op
  } else if (outputBuffer instanceof ArrayBuffer) {
    outputBuffer = Buffer.from(outputBuffer);
  } else if (ArrayBuffer.isView(outputBuffer)) {
    outputBuffer = Buffer.from(outputBuffer.buffer);
  }

  return {
    type: finalCanvas.type || 'image/png',
    buffer: outputBuffer,
  };
};
