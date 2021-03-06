/**
Copyright 2020 Google LLC
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * A message signal from main script to autoflip worker to
 * indicate processing of next section of the videoData.
 */
interface Signal {
  /**
   * The type of the message to indicate the state of the
   * section to crop, for example "firstCrop"
   */
  type: string;
  /** The video section sequence number, start from 0 */
  videoId: number;
  /** The start frameId of the video section */
  startId: number;
  /** The start timestamp of the video section */
  startTime: number;
  /** The width dimention of the video */
  width: number;
  /** The height dimention of the video */
  height: number;
  /** The processing window, the duration of the section (2s) */
  window: number;
  /** The indicator of the last section of the video */
  end: boolean;
  /** The user input parameters for cropping */
  user: { inputWidth: number; inputHeight: number };
}

/**
 * A rectangle element with position information
 */
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A color defined with r, g, b
 */
interface Color {
  r: number;
  g: number;
  b: number;
}

/**
 * Self-contained message that provides all needed information to render
 * autoflip with an external renderer.
 */
interface ExternalRenderingInformation {
  /**
   * Rect that must be cropped out of the input frame.  It is in the original
   * dimensions of the input video.  The first step to render this frame is to
   * crop this rect from the input frame.
   */
  cropFromLocation?: Rect;
  /**
   * The placement location where the above rect is placed on the output frame.
   * This will always have the same aspect ratio as the above rect but scaling
   * may be required
   */
  renderToLocation?: Rect;
  /**
   * If render_to_location is smaller than the output dimensions of the frame,
   * fill the rest of the frame with this color.
   */
  padding_color?: Color;
  /** Timestamp in microseconds of this frame. */
  timestampUS?: number;
  /**
   * Target width of the cropped video in pixels. |render_to_location| is
   * relative to this dimension
   */
  targetWidth?: number;
  /**
   * Target height of the cropped video in pixels. |render_to_location| is
   * relative to this dimension
   */
  targetHeight?: number;
}

/**
 * Self-contained message that provides information for a face bounding box
 */
interface faceDetectRegion {
  /**
   * Face bounding box for detecting full face.
   */
  faceRegion?: Rect | undefined;

  /** Timestamp in microseconds of the detected face bounding box. */
  timestamp?: number;
}

importScripts('autoflip_wasm/autoflip_live_bin.js');
importScripts('autoflip_wasm/autoflip_live_loader.js');

const ctx: any = self;
let videoWidth: number = 0;
let videoHeight: number = 0;
let videoAspectWidth: number = 1;
let videoAspectHeight: number = 1;
let workerWindow: number = 0;
let resultCropInfo: ExternalRenderingInformation[] = [];
let resultShots: number[] = [];
let resultFaces: faceDetectRegion[] = [];
let timestampHead = 0;
let frameNumber = workerWindow * 15;

console.log(`frameNumber initailize`, frameNumber);

// Gets the indexDB database to fetch the decoded frame data
let dbAutoflip: IDBDatabase;
const requestAutoFlip = indexedDB.open('auto-flip', 1);
requestAutoFlip.onerror = (event: Event): void => {
  console.error('AUTOFLIP: Failed to load indexeddb');
  throw new Error(String(event));
};
requestAutoFlip.onsuccess = (event: Event): void => {
  dbAutoflip = (event.target as IDBOpenDBRequest).result;
};

// Sets autoflip module with event listeners.
declare const Module: any;
Module.locateFile = (f: string): string => `autoflip_wasm/${f}`;

let autoflipModule: any;
const demo = (this as any).DemoModule(Module);

/** Analyzes the input frames and output caculated crop windows for each frame. */
onmessage = function (e: MessageEvent): void {
  let signal: Signal = e.data;
  console.log(`AUTOFLIP: video(${signal.videoId}) start to crop`, signal);

  if (signal.type === 'changeAspectRatio') {
    videoAspectWidth = signal.user.inputWidth;
    videoAspectHeight = signal.user.inputHeight;
    console.log('restart autoflip');
    autoflipModule.setAspectRatio(videoAspectWidth, videoAspectHeight);
    autoflipModule.cycleGraph();
    timestampHead = Math.floor(signal.startId * (1 / 15) * 1000000);
  }

  if (
    signal.user.inputWidth !== videoAspectWidth ||
    signal.user.inputHeight !== videoAspectHeight
  ) {
    return;
  }

  if (signal.type === 'firstCrop') {
    videoWidth = signal.width;
    videoHeight = signal.height;
    workerWindow = signal.window;
    videoAspectWidth =
      signal.user.inputWidth === 0 ? 1 : signal.user.inputWidth;
    videoAspectHeight =
      signal.user.inputHeight === 0 ? 1 : signal.user.inputHeight;
    frameNumber = workerWindow * 15;
    console.log(
      `user input Autoflip`,
      signal.user.inputWidth,
      signal.user.inputHeight,
    );
    demo.then((module: any): void => {
      autoflipModule = module;
      // These are the listeners that will recieve the changes from autoflip.
      // They are called whenever there is a change.
      let shotChange = {
        onShot: (stream: string, change: boolean, timestampMs: number) => {
          const timestampForVideo = timestampMs + timestampHead;
          resultShots.push(timestampForVideo);
          console.log(
            `detect shot!`,
            timestampForVideo,
            timestampMs,
            timestampHead,
          );
        },
      };
      let externalRendering = {
        onExternalRendering: (stream: string, proto: string) => {
          let cropInfo = convertSeralizedExternalRenderingInfoToObj(proto);
          resultCropInfo.push(cropInfo);
          console.log(`detect crop window!`, cropInfo);
        },
      };
      let faceDetect = {
        onFace: (stream: string, proto: string, timestamp: number) => {
          let faceInfo: faceDetectRegion = convertSeralizedFaceDetectionInfoToObj(
            proto,
            timestamp,
          );
          resultFaces.push(faceInfo);
          console.log(`detect face window!`, faceInfo);
        },
      };
      const shotPacketListener: any = autoflipModule.PacketListener.implement(
        shotChange,
      );
      const extPacketListener: any = autoflipModule.PacketListener.implement(
        externalRendering,
      );
      const facePacketListener: any = autoflipModule.PacketListener.implement(
        faceDetect,
      );

      autoflipModule.attachListener(
        'external_rendering_per_frame',
        extPacketListener,
      );
      autoflipModule.attachListener('shot_change', shotPacketListener);
      autoflipModule.attachListener('face_regions', facePacketListener);

      fetch('autoflip_wasm/autoflip_web_graph.binarypb')
        .then(
          (response): Promise<ArrayBuffer> => {
            return response.arrayBuffer();
          },
        )
        .then((buffer): void => {
          autoflipModule.setAspectRatio(videoAspectWidth, videoAspectHeight);
          autoflipModule.changeBinaryGraph(buffer);
        });
    });
  }

  if (signal.type === 'changeAspectRatio') {
    frameNumber = (1 + signal.videoId) * 15 * workerWindow - signal.startId;
  } else {
    frameNumber = workerWindow * 15;
  }
  // Gets frameData from indexDB and process with Autoflip.
  readFramesFromIndexedDB(signal.videoId, signal.startId, frameNumber).then(
    (value: Frame[]): void => {
      console.log(`PROMISE: promise ${signal.videoId} returned`);
      let frameData: Frame[] = value;
      handleFrames(frameData, signal);
      if (signal.end === true) {
        // This closes the graph and posts the final
        // analysis result back to main script.
        const b = autoflipModule.closeGraphInternal();
        ctx.postMessage({
          type: 'finishedAnalysis',
          cropWindows: resultCropInfo,
          startId: signal.startId,
          videoId: signal.videoId,
          shots: resultShots,
          faceDetections: resultFaces,
          user: signal.user,
        });
      } else {
        autoflipModule.runTillIdle();
        // This posts the current analysis result back to main script.
        ctx.postMessage({
          type: 'currentAnalysis',
          cropWindows: resultCropInfo,
          startId: signal.startId,
          videoId: signal.videoId,
          shots: resultShots,
          faceDetections: resultFaces,
          user: signal.user,
        });
      }
      resultCropInfo = [];
      resultShots = [];
      resultFaces = [];
    },
  );
};

/** Processes input frames with autoflip wasm. */
async function handleFrames(
  frameData: Frame[],
  signal: Signal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(
      `AUTOFLIP: video (${signal.videoId}) received from main`,
      frameData,
    );
    const info = { width: videoWidth, height: videoHeight };
    for (let i = 0; i < frameData.length; i++) {
      const image = frameData[i].data; // Array buffer from FFmpeg, .tiff <-
      // Saving array buffer to the wasm heap memory.
      const numBytes = image.byteLength;
      const ptr = ctx.Module._malloc(numBytes);
      const heapBytes = new Uint8Array(ctx.Module.HEAPU8.buffer, ptr, numBytes);
      const uint8Image = new Uint8Array(image);
      heapBytes.set(uint8Image);
      // End saving memory.
      const status = autoflipModule.processRawYuvBytes(
        ptr,
        info.width,
        info.height,
      );
      // Do this to check if it saved correctly.
      if (!status) {
        console.error(status);
        throw new Error('Autoflip had an error!');
      }
      // Finish.
      autoflipModule._free(ptr);
    }
    resolve('success');
  });
}

/** Reads frame decode data rows from the indexDB. */
async function readFramesFromIndexedDB(
  videoId: number,
  startId: number,
  frameNumber: number,
): Promise<Frame[]> {
  console.log(`startid`, startId);
  const key = startId;
  console.log(`frameNumber last`, frameNumber);
  console.log(`key, read from database`, key, frameNumber);
  const transaction: IDBTransaction = dbAutoflip.transaction(['decodedFrames']);
  const objectStore: IDBObjectStore = transaction.objectStore('decodedFrames');
  let frameData: Frame[] = [];
  return new Promise((resolve, reject) => {
    transaction.oncomplete = function (): void {
      console.log(
        `AUTOFLIP: IndexDB: Transaction get is complete for section ${videoId}`,
      );
      resolve(frameData);
    };
    transaction.onerror = function (): void {
      reject(`Transaction get failed for section ${videoId}`);
    };
    for (let i = 0; i < frameNumber; i++) {
      let request = objectStore.get(key + i);
      request.onerror = function (event) {
        console.log(
          'AUTOFLIP: IndexDB: Unable to retrieve data from database!',
        );
      };
      request.onsuccess = function (event: Event): void {
        // Do something with the request.result!
        if (request.result) {
          frameData.push(request.result);
        } else {
          console.log(
            `IndexDB:frame(${key + i}) couldn't be found in your database!`,
          );
        }
      };
    }
  });
}

/** Transfers the crop windows rectangles from stream. */
function convertSeralizedRectToObj(protoArray: number[]): Rect | undefined {
  if (protoArray.length !== 4) {
    return undefined;
  }
  return {
    x: protoArray[0] ?? 0,
    y: protoArray[1] ?? 0,
    width: protoArray[2] ?? 0,
    height: protoArray[3] ?? 0,
  };
}

/** Transfers the background color rectangles from stream. */
function convertSeralizedColorToObj(protoArray: number[]): Color | undefined {
  if (protoArray.length !== 3) {
    return undefined;
  }
  return {
    r: protoArray[0] ?? 0,
    g: protoArray[1] ?? 0,
    b: protoArray[2] ?? 0,
  };
}

/** Transfers the overall crop and render information from stream. */
function convertSeralizedExternalRenderingInfoToObj(
  protoString: string,
): ExternalRenderingInformation {
  const protoArray: any[] = JSON.parse(protoString);
  const renderInformation: Partial<ExternalRenderingInformation> = {};
  if (protoArray[0] ?? false) {
    renderInformation.cropFromLocation = convertSeralizedRectToObj(
      protoArray[0] as any[],
    );
  }
  if (protoArray[1] ?? false) {
    renderInformation.renderToLocation = convertSeralizedRectToObj(
      protoArray[1] as any[],
    );
  }
  if (protoArray[2] ?? false) {
    renderInformation.padding_color = convertSeralizedColorToObj(
      protoArray[2] as any[],
    );
  }
  renderInformation.timestampUS = protoArray[3] ?? 0;
  if (protoArray[4] ?? false) {
    renderInformation.targetWidth = protoArray[4];
  }
  if (protoArray[5] ?? false) {
    renderInformation.targetHeight = protoArray[5];
  }
  return renderInformation;
}

/** Transfers the overall crop and render information from stream. */
function convertSeralizedFaceDetectionInfoToObj(
  protoString: string,
  timestamp: number,
): faceDetectRegion {
  console.log('proto', protoString);
  const protoArray: any[] = JSON.parse(protoString);
  const faceDetectionInfo: faceDetectRegion = {};
  if (protoArray ?? false) {
    faceDetectionInfo.faceRegion = convertSeralizedRectToObj(
      protoArray as any[],
    );
  }
  faceDetectionInfo.timestamp = timestamp;
  return faceDetectionInfo;
}
