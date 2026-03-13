class HnCuteEditor {
   constructor(database) {
       this.database = database;
       this.fabricCanvas = null;
       this.assetsData = null;
       this.storedImages = null;
       this.canvasWidth = 900;
       this.canvasHeight = 1352;
       this.isBusy = false;
       this.editorStarted = false;
       this.uploadCache = null;
       this.cachedVideoBlob = null;
       
       this.activeFilter = { type: 'none', value: null };
       this.photoPreview = document.getElementById('photoPreview');
       this.customStickerButtonsContainer = document.getElementById('custom-sticker-buttons-container');
       this.filterButtonsContainer = document.getElementById('filter-buttons-container');
       this.templateThumbnail = document.getElementById('template-thumbnail');
       this.templateName = document.getElementById('template-name');
       this.templatePoses = document.getElementById('template-poses');
       this.changeTemplateBtn = document.getElementById('change-template-btn');
       
       window.addEventListener('hashchange', () => this._handleHashChange());
   }

   init() {
       this._handleHashChange();
       try {
           const storedData = sessionStorage.getItem('hncutePhotos');
           this.storedImages = (storedData && storedData !== 'undefined') ? JSON.parse(storedData) : null;
       } catch (e) {
           console.error("Gagal mem-parsing hncutePhotos:", e);
           this.storedImages = null;
       }

       if (this.storedImages && this.storedImages.length > 0) {
           this.startEditor();
           this._updateSessionHistory();
       } else {
           if (this.photoPreview) {
               this.photoPreview.innerHTML = `<p style="color:var(--light-text); text-align:center;">Tidak ada foto ditemukan.<br>Silakan kembali untuk mengambil foto.</p>`;
           }
           const editBtn = document.getElementById('edit-photo-btn');
           if (editBtn) editBtn.disabled = true;
           const dlBtn = document.getElementById('download-now-btn');
           if (dlBtn) dlBtn.disabled = true;
       }
   }

   async startEditor() {
       if (this.editorStarted) return;
       this.editorStarted = true;
       this._setupFabricControls();

       try {
           const response = await fetch('assets.json?v=' + Date.now());
           if (!response.ok) throw new Error('Gagal memuat assets.json');
           this.assetsData = await response.json();

           const selectedFrameSrc = sessionStorage.getItem('selectedFrame');
           if (!selectedFrameSrc) {
               alert('Template tidak ditemukan. Silakan pilih template lagi.');
               return window.location.href = 'template-selection';
           }

           const frameImageForSizing = await this._loadImage(selectedFrameSrc);
           this.canvasWidth = frameImageForSizing.naturalWidth;
           this.canvasHeight = frameImageForSizing.naturalHeight;

           let templateName = 'Template Kustom';
           let templateThumbnailSrc = selectedFrameSrc;

           const templateData = this.assetsData.dynamicFrames?.find(f => f.src === selectedFrameSrc);
           
           if (templateData) {
               templateName = templateData.name;
               templateThumbnailSrc = templateData.src;
           } else {
               try {
                   const storedTemplate = sessionStorage.getItem('hncuteTemplate');
                   if (storedTemplate) {
                        const parsed = JSON.parse(storedTemplate);
                        if (parsed.name) templateName = parsed.name;
                   } else {
                        const legacyName = sessionStorage.getItem('templateName');
                        if (legacyName) templateName = legacyName;
                   }
               } catch (e) { console.warn("Error parsing template metadata:", e); }
           }

           if (this.templateThumbnail) this.templateThumbnail.src = templateThumbnailSrc;
           if (this.templateName) this.templateName.textContent = templateName;
           if (this.templatePoses) this.templatePoses.textContent = `${this.storedImages.length} Pose`;

           this._initializeCanvas(); 
           await this._redrawCanvasWithObjects(selectedFrameSrc, frameImageForSizing); 
           await this._renderFilterButtons();
           this._renderStickerButtons();

           if (this.filterButtonsContainer) this.filterButtonsContainer.addEventListener('click', (e) => this._handleFilterClick(e));
           if (this.customStickerButtonsContainer) this.customStickerButtonsContainer.addEventListener('click', (e) => this._handleStickerClick(e));
           if (this.changeTemplateBtn) this.changeTemplateBtn.addEventListener('click', () => { window.location.href = 'template-selection.html'; });

       } catch (error) {
           console.error("Inisialisasi editor gagal:", error);
           if (this.photoPreview) {
                this.photoPreview.innerHTML = `<p style="color:var(--light-text); text-align:center; padding: 20px;"><b>Error:</b> Gagal memuat editor.<br><small>${error.message}</small></p>`;
           }
       }
   }

   async waitForIdle() {
       const start = Date.now();
       while (this.isBusy) {
           if (Date.now() - start > 60000) throw new Error("Timeout menunggu proses lain.");
           await new Promise(resolve => setTimeout(resolve, 500));
       }
   }

   async downloadAsPng() {
       await this.waitForIdle();
       const canvas = await this._drawFinalCanvas();
       canvas.toBlob(blob => {
           saveAs(blob, `pict-hncute-${Date.now()}.png`);
       });
   }

   async downloadAsGif() {
       await this.waitForIdle();
       const gifUrl = await this._generateFullGif();
       const blob = await (await fetch(gifUrl)).blob();
       saveAs(blob, `pict-hncute-${Date.now()}.gif`);
   }

   async generateCompositeVideo(blobArray, onProgress) {
       await this.waitForIdle();
       this.isBusy = true;

       const hiddenContainer = document.createElement('div');
       Object.assign(hiddenContainer.style, {
           position: 'fixed', top: '-9999px', left: '-9999px',
           width: '1px', height: '1px', overflow: 'hidden',
           opacity: '0', pointerEvents: 'none', zIndex: '-1'
       });
       document.body.appendChild(hiddenContainer);
       
       const videoElements = [];

       try {
           const frameSrc = sessionStorage.getItem('selectedFrame');
           const frameImage = await this._loadImage(frameSrc);
           const holes = await window.ImageAnalyzer.getHoleData(frameSrc, blobArray.length);
           
           const stickers = this.fabricCanvas.getObjects().filter(o => o.isSticker);
           const stickerImages = await Promise.all(stickers.map(s => this._loadImage(s._element.src)));

           let targetWidth = 720;
           if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
               targetWidth = 480;
           }

           const maxDimension = Math.max(frameImage.naturalWidth, frameImage.naturalHeight);
           let scaleFactor = 1;
           
           if (frameImage.naturalWidth > targetWidth) {
               scaleFactor = targetWidth / frameImage.naturalWidth;
           }

           const canvas = document.createElement('canvas');
           canvas.width = Math.ceil(frameImage.naturalWidth * scaleFactor);
           canvas.height = Math.ceil(frameImage.naturalHeight * scaleFactor);
           const ctx = canvas.getContext('2d');
           
           ctx.imageSmoothingEnabled = true;
           ctx.imageSmoothingQuality = 'high';

           const loadVideoPromises = blobArray.map(blob => {
               return new Promise((resolve, reject) => {
                    const video = document.createElement('video');
                    video.muted = true;
                    video.playsInline = true;
                    video.loop = true;
                    video.src = URL.createObjectURL(blob);
                    video.setAttribute('playsinline', ''); 
                    video.setAttribute('webkit-playsinline', '');
                    video.style.width = '10px';
                    video.style.height = '10px';

                    hiddenContainer.appendChild(video);
                    
                    const timeout = setTimeout(() => reject(new Error("Video load timeout")), 10000);

                    const onReady = async () => {
                        clearTimeout(timeout);
                        try {
                            await video.play();
                            resolve(video);
                        } catch (e) {
                            console.warn("Video play failed, retrying...", e);
                            try { video.muted = true; await video.play(); resolve(video); } 
                            catch(e2) { reject(e2); }
                        }
                    };

                    if (video.readyState >= 3) onReady();
                    else {
                        video.oncanplay = onReady;
                        video.onerror = () => { clearTimeout(timeout); reject(new Error("Video load error")); };
                    }
               });
           });

           const loadedVideos = await Promise.all(loadVideoPromises);
           loadedVideos.forEach(v => videoElements.push(v));

           const isAndroid = /Android/i.test(navigator.userAgent);
           let mimeTypes = isAndroid 
               ? ['video/webm; codecs=vp9', 'video/webm', 'video/mp4']
               : ['video/mp4; codecs="avc1.42E01E, mp4a.40.2"', 'video/mp4', 'video/webm'];
           
           let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
           
           const stream = canvas.captureStream(30);
           let recorder;

           const VIDEO_BITRATE = 4000000; 
           
           try {
                if (selectedMimeType) {
                    recorder = new MediaRecorder(stream, { 
                        mimeType: selectedMimeType, 
                        videoBitsPerSecond: VIDEO_BITRATE 
                    });
                } else {
                    throw new Error("No supported types found");
                }
           } catch (e) {
                console.warn("MediaRecorder init failed, trying fallback:", e);
                try {
                    recorder = new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITRATE });
                    selectedMimeType = recorder.mimeType;
                } catch (e2) {
                    recorder = new MediaRecorder(stream);
                    selectedMimeType = recorder.mimeType;
                }
           }
           
           let fileExtension = selectedMimeType && selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
           const chunks = [];
           recorder.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };

           return new Promise((resolve, reject) => {
               recorder.onstop = () => {
                   const finalBlob = new Blob(chunks, { type: selectedMimeType });
                   
                   videoElements.forEach(v => { 
                       v.pause();
                       if (v.src.startsWith('blob:')) URL.revokeObjectURL(v.src);
                       v.src = ''; v.load(); 
                   });
                   if (document.body.contains(hiddenContainer)) document.body.removeChild(hiddenContainer);

                   finalBlob.extensionHint = fileExtension;
                   if(onProgress) onProgress(100);
                   this.isBusy = false;
                   resolve(finalBlob);
               };

               recorder.onerror = (e) => {
                   if (document.body.contains(hiddenContainer)) document.body.removeChild(hiddenContainer);
                   this.isBusy = false;
                   reject(e);
               };

               recorder.start();

               const startTime = Date.now();
               const DURATION = 4000; 

               const draw = () => {
                   if (recorder.state === 'inactive') return;
                   const elapsed = Date.now() - startTime;
                   if (onProgress) {
                       const percent = Math.min(99, Math.floor((elapsed / DURATION) * 100));
                       onProgress(percent);
                   }
                   if (elapsed > DURATION) {
                       recorder.stop();
                       return;
                   }

                   ctx.clearRect(0, 0, canvas.width, canvas.height);
                   const isMirrored = sessionStorage.getItem('isVideoMirrored') === 'true';
                   
                   if (this.activeFilter.type !== 'none') {
                       const fVal = this.activeFilter.value;
                       switch(this.activeFilter.type) {
                           case 'greyscale': ctx.filter = 'grayscale(100%)'; break;
                           case 'sepia': ctx.filter = 'sepia(100%)'; break;
                           case 'invert': ctx.filter = 'invert(100%)'; break;
                           case 'brightness': ctx.filter = `brightness(${100 + fVal}%)`; break;
                           case 'contrast': ctx.filter = `contrast(${100 + fVal}%)`; break;
                           case 'saturation': ctx.filter = `saturate(${100 + fVal}%)`; break;
                           case 'vintage': ctx.filter = 'sepia(50%) contrast(120%)'; break;
                           case 'lomo': ctx.filter = 'contrast(150%) saturate(120%)'; break;
                           default: ctx.filter = 'none';
                       }
                   } else {
                       ctx.filter = 'none';
                   }

                   videoElements.forEach((vid, i) => {
                       const hole = holes[i];
                       if (hole) {
                           const tX = hole.x * scaleFactor;
                           const tY = hole.y * scaleFactor;
                           const tW = hole.width * scaleFactor;
                           const tH = hole.height * scaleFactor;

                           const hRatio = tW / tH;
                           if (vid.videoWidth === 0) return;
                           
                           const vRatio = vid.videoWidth / vid.videoHeight;
                           let sWidth, sHeight, sx, sy;

                           if (hRatio > vRatio) {
                               sWidth = vid.videoWidth;
                               sHeight = vid.videoWidth / hRatio;
                               sx = 0; sy = (vid.videoHeight - sHeight) / 2;
                           } else {
                               sHeight = vid.videoHeight;
                               sWidth = vid.videoHeight * hRatio;
                               sy = 0; sx = (vid.videoWidth - sWidth) / 2;
                           }

                           if (isMirrored) {
                               ctx.save();
                               ctx.translate(tX + tW / 2, tY + tH / 2);
                               ctx.scale(-1, 1);
                               ctx.drawImage(vid, sx, sy, sWidth, sHeight, -tW / 2, -tH / 2, tW, tH);
                               ctx.restore();
                           } else {
                               ctx.drawImage(vid, sx, sy, sWidth, sHeight, tX, tY, tW, tH);
                           }
                       }
                   });
                   
                   ctx.filter = 'none';
                   
                   ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
                   
                   stickers.forEach((s, idx) => {
                        const img = stickerImages[idx];
                        if (img) {
                            const mappingScale = canvas.width / this.canvasWidth;
                            
                            ctx.save();
                            const centerX = s.left * mappingScale + (s.width * s.scaleX * mappingScale / 2);
                            const centerY = s.top * mappingScale + (s.height * s.scaleY * mappingScale / 2);
                            
                            ctx.translate(centerX, centerY);
                            ctx.rotate(s.angle * Math.PI / 180);
                            ctx.drawImage(img, 
                                - (s.width * s.scaleX * mappingScale / 2), 
                                - (s.height * s.scaleY * mappingScale / 2), 
                                s.width * s.scaleX * mappingScale, 
                                s.height * s.scaleY * mappingScale
                            );
                            ctx.restore();
                        }
                   });

                   requestAnimationFrame(draw);
               };
               draw();
           });

       } catch (err) {
           this.isBusy = false;
           if (document.body.contains(hiddenContainer)) document.body.removeChild(hiddenContainer);
           throw err;
       }
   }
   
   async getUploadUrl(onProgress) {
       await this.waitForIdle();
       if (this.uploadCache?.url) {
           if (onProgress) onProgress(100);
           return { url: this.uploadCache.url, assets: this.uploadCache.assets };
       }
       return await this._generateAndUploadAssets(onProgress);
   }
   
   async generatePreviewCanvas() {
       await this.waitForIdle();
       if (!this.fabricCanvas) throw new Error("Editor belum siap.");
       return await this._drawFinalCanvas();
   }

   _initializeCanvas() {
       const canvasEl = document.createElement('canvas');
       this.photoPreview.innerHTML = '';
       this.photoPreview.appendChild(canvasEl);
       this.fabricCanvas = new fabric.Canvas(canvasEl, { width: this.canvasWidth, height: this.canvasHeight, preserveObjectStacking: true });
       const invalidate = () => { this.uploadCache = null; };
       this.fabricCanvas.on({ 'object:modified': invalidate, 'object:added': invalidate, 'object:removed': invalidate });
       this._resizeCanvas();
       window.addEventListener('resize', () => this._resizeCanvas());
   }

   _loadImage(url) {
       return new Promise((resolve, reject) => {
           const img = new Image();
           img.crossOrigin = "Anonymous";
           img.onload = () => resolve(img);
           img.onerror = () => reject(new Error(`Gagal memuat elemen gambar: ${url}`));
           img.src = url;
       });
   }

   async _redrawCanvasWithObjects(frameSrc, frameImageElement) {
       this.fabricCanvas.clear();

       const holes = await window.ImageAnalyzer.getHoleData(frameSrc, this.storedImages.length);

       if (!holes || holes.length < this.storedImages.length) {
           throw new Error(`Gagal mendeteksi area foto yang cocok (${holes.length}/${this.storedImages.length}). Mungkin templatenya rusak.`);
       }

       const photoImageElements = await Promise.all(this.storedImages.map(src => this._loadImage(src)));

       photoImageElements.forEach((imgEl, i) => {
           const hole = holes[i];
           if (!imgEl || !hole) return;

           const photo = new fabric.Image(imgEl);
           const holeAspectRatio = hole.width / hole.height;
           const photoAspectRatio = photo.width / photo.height;
           let scale = (holeAspectRatio > photoAspectRatio) ? hole.width / photo.width : hole.height / photo.height;

           photo.scale(scale);

           const scaledPhotoWidth = photo.width * scale;
           const scaledPhotoHeight = photo.height * scale;
           const left = hole.x + (hole.width - scaledPhotoWidth) / 2;
           const top = hole.y + (hole.height - scaledPhotoHeight) / 2;

           photo.set({
               left: left, top: top,
               selectable: false, evented: false,
               isPhoto: true, originalImageElement: imgEl,
               clipPath: new fabric.Rect({ left: hole.x, top: hole.y, width: hole.width, height: hole.height, absolutePositioned: true })
           });
           this.fabricCanvas.add(photo);
       });

       const frame = new fabric.Image(frameImageElement);
       frame.set({ left: 0, top: 0, selectable: false, evented: false, isFrame: true });
       this.fabricCanvas.add(frame).bringToFront(frame);
       this.fabricCanvas.renderAll();
   }

   async _generateAndUploadAssets(onProgress) {
       await this.waitForIdle();
       if (!this.fabricCanvas) throw new Error("Editor belum siap.");
       this.isBusy = true;
       
       const reportProgress = (p) => {
           if (onProgress) onProgress(Math.floor(p));
       };

       const ensureFileSize = async (blob, targetMB = 4.8, maxRetries = 3) => {
           if (blob.type.includes('video')) {
               const sizeMB = blob.size / (1024 * 1024);
               if (sizeMB > 90) {
                   console.warn(`Video terlalu besar (${sizeMB.toFixed(2)}MB). Video akan di-skip.`);
                   return null; 
               }
               if (sizeMB > 10) {
                   console.warn(`Video size (${sizeMB.toFixed(2)}MB) exceeds 10MB target but within safety limits.`);
               } else {
                   console.log(`Video size optimal: ${sizeMB.toFixed(2)}MB`);
               }
               return blob;
           }

           let currentBlob = blob;
           let attempt = 0;
           let currentQuality = 0.75; 
           let currentWidth = 1920;

           const compressImage = async (b, q, w) => {
                if (typeof window.Compressor !== 'undefined') {
                    try {
                        return await new Promise((res, rej) => new Compressor(b, { quality: q, maxWidth: w, mimeType: 'image/jpeg', success: res, error: rej }));
                    } catch (e) {}
                }
                return b; 
           };

           while (currentBlob.size > targetMB * 1024 * 1024 && attempt < maxRetries) {
               currentBlob = await compressImage(currentBlob, currentQuality, currentWidth);
               currentQuality -= 0.15;
               currentWidth = Math.floor(currentWidth * 0.7); 
               attempt++;
           }
           return currentBlob;
       };

       try {
           reportProgress(5);
           const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); 
           const shortId = randomPart; 
           const timestamp = Date.now();

           const finalCanvas = await this._drawFinalCanvas();
           let stripBlob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/jpeg', 0.9));
           stripBlob = await ensureFileSize(stripBlob, 4.8);
           reportProgress(10);
           
           const simpleGifBase64 = await this._generateSimpleGif();
           let simpleGifBlob = await (await fetch(simpleGifBase64)).blob();
           reportProgress(15);
           
           const photoBlobs = await Promise.all(this.storedImages.map(async (src) => {
               const b = await (await fetch(src)).blob();
               return await ensureFileSize(b, 4.8);
           }));
           reportProgress(20);

           const isLiveMode = sessionStorage.getItem('isLiveMode') === 'true';
           let videoBlob = null;
           
           if (isLiveMode) {
               try {
                   if (this.cachedVideoBlob) {
                        videoBlob = this.cachedVideoBlob;
                        reportProgress(50);
                   } else {
                        console.log("Generating video...");
                        const clips = await this._getVideoClipsFromDB();
                        if (clips && clips.length > 0) {
                            videoBlob = await this.generateCompositeVideo(clips, (p) => {
                                    const mapped = 20 + Math.floor((p / 100) * 30); 
                                    reportProgress(mapped);
                            });
                            this.cachedVideoBlob = videoBlob;
                        }
                   }
                   
                   if (videoBlob) {
                       const checked = await ensureFileSize(videoBlob);
                       if (checked === null) videoBlob = null;
                   }
               } catch (vidErr) {
                   console.warn("Video generation failed (skipping):", vidErr);
                   videoBlob = null;
               }
           } else {
               reportProgress(50);
           }

           let uploadsList = [
               { blob: stripBlob, name: `strip_${shortId}_${timestamp}.jpg` },
               { blob: simpleGifBlob, name: `gif_${shortId}_${timestamp}.gif` }
           ];
           photoBlobs.forEach((blob, idx) => {
               uploadsList.push({ blob: blob, name: `snap_${shortId}_${idx}_${timestamp}.jpg` });
           });
           
           if (videoBlob) {
               uploadsList.push({ blob: videoBlob, name: `video_${shortId}_${timestamp}.${videoBlob.extensionHint || 'webm'}` });
           }

           const totalUploads = uploadsList.length;
           let completedUploads = 0;

           const uploadFile = async (blob, fileName) => {
                const formData = new FormData();
                formData.append('file', blob);
                formData.append('fileName', fileName);
                
                const response = await fetch("/api/upload-cloudinary", { method: "POST", body: formData });

                if (!response.ok) {
                    if (fileName.includes('video')) throw new Error("VIDEO_FAIL"); 
                    const errText = await response.text();
                    throw new Error(`Upload Failed: ${response.status} - ${errText}`);
                }
                
                completedUploads++;
                reportProgress(50 + ((completedUploads / totalUploads) * 40));
                const result = await response.json();
                return { url: result.url, name: fileName };
           };

           const uploadResults = await Promise.all(uploadsList.map(async (item) => {
               try {
                   return await uploadFile(item.blob, item.name);
               } catch (e) {
                   console.error(`Upload error for ${item.name}:`, e);
                   if (e.message === "VIDEO_FAIL") return null;
                   throw e;
               }
           }));

           const validResults = uploadResults.filter(r => r !== null);
           const getUrl = (key) => validResults.find(r => r.name.includes(key))?.url || null;

           const stripUrl = getUrl('strip_');
           const gifUrl = getUrl('gif_');
           const photoUrls = validResults.filter(r => r.name.includes('snap_'))
               .sort((a, b) => a.name.localeCompare(b.name))
               .map(r => r.url);
           const videoUrl = getUrl('video_');
           
           if (typeof window.ghRequest !== 'function') {
               throw new Error("Helper api.git.js tidak ditemukan.");
           }

           reportProgress(95);
           const mappingData = {
               id: shortId,
               strip: stripUrl,
               gif: gifUrl,
               photos: photoUrls,
               video: videoUrl,
               mode: isLiveMode ? 'camera' : 'upload',
               timestamp: timestamp
           };
           
           const path = `hncute_files/${shortId}.json`;
           const content = btoa(unescape(encodeURIComponent(JSON.stringify(mappingData, null, 2))));
           
           const ghResponse = await window.ghRequest(path, {
               method: 'PUT',
               body: JSON.stringify({ message: `create soft_file ${shortId}`, content: content })
           });
           
           if (!ghResponse.ok) throw new Error("Gagal menyimpan data ke GitHub.");

           reportProgress(100);
           const finalUrl = `https://pict-hncute.netlify.app/file?id=${shortId}`;
           this.uploadCache = { url: finalUrl, shortId: shortId, assets: mappingData };
           return { url: finalUrl, assets: mappingData };

       } catch (err) {
           console.error("Proses Generate/Upload Gagal:", err);
           this.isBusy = false;
           throw err; 
       } finally {
           this.isBusy = false;
       }
   }

   _drawFinalCanvas() {
       return new Promise((resolve, reject) => {
           this.fabricCanvas.discardActiveObject().renderAll();
           const zoom = this.fabricCanvas.getZoom();
           const dataURL = this.fabricCanvas.toDataURL({ format: 'png', quality: 1.0, multiplier: 1 / zoom });
           const finalCanvas = document.createElement('canvas');
           finalCanvas.width = this.canvasWidth; finalCanvas.height = this.canvasHeight;
           const ctx = finalCanvas.getContext('2d');
           const img = new Image();
           img.onload = () => { ctx.drawImage(img, 0, 0); resolve(finalCanvas); };
           img.onerror = () => reject(new Error("Gagal membuat gambar kanvas final."));
           img.src = dataURL;
       });
   }

   _getVideoClipsFromDB() {
       return new Promise((resolve, reject) => {
            const request = indexedDB.open("HnCuteDB", 1);
            request.onerror = (e) => resolve(null); 
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("videos")) { resolve(null); return; }
                const transaction = db.transaction(["videos"], "readonly");
                const store = transaction.objectStore("videos");
                const getReq = store.get("liveModeVideo");
                getReq.onsuccess = () => resolve(getReq.result ? getReq.result.clips : null);
                getReq.onerror = () => resolve(null);
            };
       });
   }

   async _generateFullGif() {
       const photoObjects = this.fabricCanvas.getObjects().filter(o => o.isPhoto);
       const sourceImages = this.storedImages;

       if (!sourceImages || sourceImages.length === 0 || photoObjects.length !== sourceImages.length) {
           throw new Error("Source images or photo slots are mismatched or missing for GIF generation.");
       }

       const firstFrameCanvas = await this._drawFinalCanvas();
       const gif = new GIF({
           workers: 2, quality: 10,
           width: firstFrameCanvas.width, height: firstFrameCanvas.height,
           workerScript: 'js/gif.worker.js'
       });

       const sourceImageElements = await Promise.all(sourceImages.map(src => this._loadImage(src)));
       let imagesToAnimate = [...sourceImageElements];

       for (let i = 0; i < imagesToAnimate.length; i++) {
           photoObjects.forEach((photoObj, index) => photoObj.setElement(imagesToAnimate[index]));
           this.fabricCanvas.renderAll();
           const frameCanvas = await this._drawFinalCanvas();
           gif.addFrame(frameCanvas, { delay: 500, copy: true });
           imagesToAnimate.push(imagesToAnimate.shift());
       }

       photoObjects.forEach((photoObj, index) => {
           if (sourceImageElements[index]) photoObj.setElement(sourceImageElements[index]);
       });
       this.fabricCanvas.renderAll();

       return new Promise((resolve) => {
           gif.on('finished', (blob) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result);
               reader.readAsDataURL(blob);
           });
           gif.render();
       });
   }

   async _generateSimpleGif() {
       const sourceImages = this.storedImages;
       if (!sourceImages || sourceImages.length === 0) throw new Error("Tidak ada foto sumber.");

       const imageElements = await Promise.all(sourceImages.map(src => this._loadImage(src)));
       if (imageElements.length === 0) throw new Error("Gagal memuat foto sumber.");

       const firstImg = imageElements[0];
       const MAX_DIM = 640;
       let targetWidth = firstImg.naturalWidth;
       let targetHeight = firstImg.naturalHeight;
       
       if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
           const scale = Math.min(MAX_DIM / targetWidth, MAX_DIM / targetHeight);
           targetWidth = Math.round(targetWidth * scale);
           targetHeight = Math.round(targetHeight * scale);
       }

       const gif = new GIF({
           workers: 2, quality: 1,
           width: targetWidth, height: targetHeight,
           workerScript: 'js/gif.worker.js'
       });

       for (const img of imageElements) {
           const tempCanvas = document.createElement('canvas');
           tempCanvas.width = targetWidth; tempCanvas.height = targetHeight;
           const ctx = tempCanvas.getContext('2d');
           
           ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
           gif.addFrame(tempCanvas, { delay: 500, copy: true });
       }

       return new Promise((resolve) => {
           gif.on('finished', (blob) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result);
               reader.readAsDataURL(blob);
           });
           gif.render();
       });
   }

   _resizeCanvas() {
       if (!this.photoPreview) return;
       const containerWidth = this.photoPreview.clientWidth;
       const containerHeight = this.photoPreview.clientHeight; 

       if (containerWidth > 0 && this.fabricCanvas) {
           const hRatio = containerWidth / this.canvasWidth;
           const vRatio = containerHeight / this.canvasHeight;
           
           let scale = (containerHeight > 0) ? Math.min(hRatio, vRatio) : hRatio;

           this.fabricCanvas.setDimensions({ width: this.canvasWidth * scale, height: this.canvasHeight * scale });
           this.fabricCanvas.setZoom(scale);
       }
   }

   async _renderFilterButtons() {
       if (!this.filterButtonsContainer || !this.storedImages?.[0]) return;
       this.filterButtonsContainer.innerHTML = '';
       const filters = [ { name: 'Normal', type: 'none' }, { name: 'Vintage', type: 'vintage' }, { name: 'Lomo', type: 'lomo' }, { name: 'Clarity', type: 'clarity' }, { name: 'Sin City', type: 'sinCity' }, { name: 'Sunrise', type: 'sunrise' }, { name: 'Cross Process', type: 'crossProcess' }, { name: 'Orange Peel', type: 'orangePeel' }, { name: 'Love', type: 'love' }, { name: 'Grungy', type: 'grungy' }, { name: 'Jarques', type: 'jarques' }, { name: 'Pinhole', type: 'pinhole' }, { name: 'Old Boot', type: 'oldBoot' }, { name: 'Glowing Sun', type: 'glowingSun' }, { name: 'Hazy Days', type: 'hazyDays' }, { name: 'Her Majesty', type: 'herMajesty' }, { name: 'Nostalgia', type: 'nostalgia' }, { name: 'Hemingway', type: 'hemingway' }, { name: 'Concentrate', type: 'concentrate' }, { name: 'Emboss', type: 'emboss' }, { name: 'Greyscale', type: 'greyscale' }, { name: 'Invert', type: 'invert' }, { name: 'Sepia', type: 'sepia' }, { name: 'Brightness', type: 'brightness', value: 10 }, { name: 'Contrast', type: 'contrast', value: 10 }, { name: 'Saturation', type: 'saturation', value: 10 }, { name: 'Noise', type: 'noise', value: 20 }, { name: 'Sharpen', type: 'sharpen', value: 15 } ];
       const baseImage = await this._loadImage(this.storedImages[0]);
       for (const f of filters) {
           const item = document.createElement('div');
           item.className = 'filter-card';
           item.dataset.filter = f.type;
           if (f.value) item.dataset.value = f.value;
           if (f.type === 'none') item.classList.add('active');
           
           const divText = document.createElement('div'); 
           divText.className = 'filter-card-text';
           divText.textContent = f.name;
           
           const THUMB_SIZE = 300;
           const thumbCanvas = document.createElement('canvas');
           thumbCanvas.width = THUMB_SIZE; thumbCanvas.height = THUMB_SIZE;
           const ctx = thumbCanvas.getContext('2d');
           const sourceSize = Math.min(baseImage.naturalWidth, baseImage.naturalHeight);
           const sourceX = (baseImage.naturalWidth - sourceSize) / 2;
           const sourceY = (baseImage.naturalHeight - sourceSize) / 2;
           ctx.drawImage(baseImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, THUMB_SIZE, THUMB_SIZE);
           
           const img = new Image();
           img.className = 'filter-card-image';
           
           if (f.type !== 'none') {
               Caman(thumbCanvas, function() {
                   this[f.type](f.value).render(() => { img.src = this.toBase64(); });
               });
           } else { img.src = thumbCanvas.toDataURL(); }
           
           item.append(img, divText);
           this.filterButtonsContainer.appendChild(item);
       }
   }
   
   async _handleHashChange() {
       const isDone = window.location.hash === '#done';
       const doneSection = document.getElementById('done-section');
       
       if (doneSection) {
           if (isDone) {
               if (window.openDoneSection) window.openDoneSection();
               else { doneSection.classList.remove('hidden'); doneSection.classList.add('flex'); }
               
               const container = document.getElementById('final-preview-container');
               if (container) {
                   container.innerHTML = `<span class="iconify text-4xl text-[#7C7850] animate-spin" data-icon="svg-spinners:90-ring-with-bg"></span>`;
                   try {
                        const canvas = await this.generatePreviewCanvas();
                        const img = document.createElement('img');
                        img.src = canvas.toDataURL('image/png');
                        img.className = "max-w-full max-h-full object-contain rounded-xl shadow-none";
                        container.innerHTML = ''; container.appendChild(img);
                   } catch(e) { console.error(e); }
               }

               const toggleContainer = document.getElementById('result-toggle-container');
               const isLiveMode = sessionStorage.getItem('isLiveMode') === 'true';

               if (toggleContainer) {
                   if (isLiveMode) {
                       toggleContainer.classList.remove('hidden'); toggleContainer.classList.add('flex');
                       if (window.toggleResultView) window.toggleResultView('photo');
                   } else {
                       toggleContainer.classList.add('hidden'); toggleContainer.classList.remove('flex');
                       if (window.toggleResultView) window.toggleResultView('photo');
                   }
               }

               const videoContainer = document.getElementById('final-video-preview-container');
               if (videoContainer && isLiveMode) {
                   videoContainer.innerHTML = `<span class="iconify text-4xl text-[#7C7850] animate-spin" data-icon="svg-spinners:90-ring-with-bg"></span>`;
                   try {
                       const clips = await this._getVideoClipsFromDB();
                       if (clips && clips.length > 0) {
                           if (!this.cachedVideoBlob) {
                               this.cachedVideoBlob = await this.generateCompositeVideo(clips);
                           }
                           const vid = document.createElement('video');
                           vid.src = URL.createObjectURL(this.cachedVideoBlob);
                           vid.controls = true; vid.autoplay = true; vid.loop = true; vid.muted = true;
                           vid.setAttribute('playsinline', '');
                           vid.setAttribute('webkit-playsinline', '');
                           vid.className = "max-w-full max-h-full object-contain rounded-xl shadow-none";
                           videoContainer.innerHTML = ''; videoContainer.appendChild(vid);
                           try { vid.play(); } catch(e){}
                       } else { videoContainer.innerHTML = '<p class="text-[#7C7850] text-sm">No clips found</p>'; }
                   } catch(e) {
                       console.error(e);
                       videoContainer.innerHTML = `<div class="text-center p-2"><p class="text-red-500 font-bold text-lg mb-1">Video Error</p><p class="text-red-400 text-xs font-mono break-all">${e.message}</p></div>`;
                   }
               }
           } else { 
               if (window.closeDoneSection) window.closeDoneSection();
               else { doneSection.classList.add('hidden'); doneSection.classList.remove('flex'); }
           }
       }
   }

   async _renderStickerButtons() {
       if (!this.customStickerButtonsContainer) return;
       this.customStickerButtonsContainer.innerHTML = '';

       try {
           const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
           const userRole = sessionStorage.getItem('userRole');
           const headers = {
               'X-User-Role': userRole,
               'X-User-Name': userData.username || userData.email
           };

           const res = await fetch('/api/content?type=sticker', { headers });
           if (!res.ok) throw new Error("Failed to fetch stickers");

           const stickers = await res.json();

           if (Array.isArray(stickers)) {
               stickers.forEach(sticker => {
                   const src = sticker.icon || sticker.src;
                   const btn = document.createElement('button');
                   btn.className = 'sticker-btn';
                   btn.dataset.src = src;
                   btn.innerHTML = `<img src="${src}" alt="Stiker" loading="lazy">`;
                   this.customStickerButtonsContainer.appendChild(btn);
               });
           }
       } catch (e) {
           console.error("Sticker Load Error:", e);
       }
   }

   async _handleFilterClick(e) {
       if (this.isBusy) return;
       const item = e.target.closest('.filter-card');
       if (!item) return;
       
       this.isBusy = true; 
       this.uploadCache = null;
       this.cachedVideoBlob = null;
       
       const selectedFilter = item.dataset.filter;
       const filterValue = item.dataset.value ? parseInt(item.dataset.value, 10) : null;
       
       this.activeFilter = { type: selectedFilter, value: filterValue };
       
       this.filterButtonsContainer.querySelectorAll('.filter-card.active').forEach(i => i.classList.remove('active'));
       item.classList.add('active');
       
       const photoObjects = this.fabricCanvas.getObjects().filter(obj => obj.isPhoto);

       try {
           for (const photoObj of photoObjects) {
               const originalElement = photoObj.originalImageElement;
               if (selectedFilter === 'none') {
                   photoObj.setElement(originalElement);
               } else {
                   const tempCanvas = document.createElement('canvas');
                   tempCanvas.width = originalElement.naturalWidth;
                   tempCanvas.height = originalElement.naturalHeight;
                   tempCanvas.getContext('2d').drawImage(originalElement, 0, 0);
                   
                   const filteredUrl = await new Promise(res => Caman(tempCanvas, function() {
                       this[selectedFilter](filterValue).render(() => res(this.toBase64()));
                   }));
                   const filteredElement = await this._loadImage(filteredUrl);
                   photoObj.setElement(filteredElement);
               }
           }
       } finally { this.fabricCanvas.renderAll(); this.isBusy = false; }
   }

   _handleStickerClick(e) {
       const btn = e.target.closest('.sticker-btn');
       if (!btn) return;
       this._loadImage(btn.dataset.src).then(imgEl => {
           const img = new fabric.Image(imgEl);
           img.scaleToWidth(this.canvasWidth / 4);
           img.set({ left: (this.canvasWidth - img.getScaledWidth()) / 2, top: (this.canvasHeight - img.getScaledHeight()) / 3, borderColor: '#20c997', cornerColor: '#20c997', cornerSize: 24, transparentCorners: false, cornerStyle: 'circle', isSticker: true });
           this.fabricCanvas.add(img).setActiveObject(img);
       });
   }
   
   _setupFabricControls() {
       const deleteObject = (eventData, transform) => { transform.target.canvas.remove(transform.target); transform.target.canvas.requestRenderAll(); };
       const flipObject = (eventData, transform) => { transform.target.toggle('flipX'); transform.target.canvas.requestRenderAll(); };
       const renderDeleteIcon = (ctx, left, top) => { const size = 24; ctx.save(); ctx.translate(left, top); ctx.fillStyle = 'rgba(239, 83, 80, 0.9)'; ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-size/4, -size/4); ctx.lineTo(size/4, size/4); ctx.moveTo(size/4, -size/4); ctx.lineTo(-size/4, size/4); ctx.stroke(); ctx.restore(); };
       fabric.Object.prototype.controls.deleteControl = new fabric.Control({ x: 0.5, y: -0.5, cursorStyle: 'pointer', mouseUpHandler: deleteObject, render: renderDeleteIcon });
       fabric.Object.prototype.controls.mirrorControl = new fabric.Control({ x: -0.5, y: -0.5, cursorStyle: 'pointer', mouseUpHandler: flipObject, render: (ctx, l, t) => { const s = 24; ctx.save(); ctx.translate(l, t); ctx.fillStyle = 'rgba(66, 133, 244, 0.9)'; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'white'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↔', 0, 1); ctx.restore(); }});
   }

   _updateSessionHistory() {
       try {
           const sessions = JSON.parse(localStorage.getItem('hncuteSessions') || '[]');
           if (sessions.length > 0) {
               const latest = sessions[0];
               if (latest.frameSrc === sessionStorage.getItem('selectedFrame')) {
                   latest.timestamp = Date.now();
                   localStorage.setItem('hncuteSessions', JSON.stringify(sessions));
               }
           }
       } catch (e) { console.warn("Failed to update session history timestamp", e); }
   }
}