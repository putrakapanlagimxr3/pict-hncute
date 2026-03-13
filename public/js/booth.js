document.addEventListener('DOMContentLoaded', () => {
    const videoEl = document.getElementById('video');
    const actionBtn = document.getElementById('actionBtn');
    const templateContainer = document.getElementById('templateContainer');
    const photosGrid = document.getElementById('photosGrid');
    const frameOverlay = document.getElementById('frameOverlay');
    const timerDisplay = document.getElementById('timer-display');
    const countdownText = document.getElementById('countdownText');
    const flash = document.getElementById('flash');
    const messageOverlay = document.getElementById('messageOverlay');
    const toast = document.getElementById('toast');
    const timeoutPopup = document.getElementById('timeout-popup');
    
    let currentStream = null;
    let isCapturing = false;
    let displayImages = [];
    let isRetakeMode = false;
    let retakeIndex = null;
    let TOTAL_PHOTOS = 4;
    let frameName = 'Template';
    let frameSrc = '';
    let layoutParam = '';
    let redirectTarget = 'edit';
    let sessionTimerInterval;
    
    let mediaRecorder;
    let currentClipChunks = [];
    let recordedClips = [];
    let supportedMimeType = 'video/webm';
    
    let db;
    const dbRequest = indexedDB.open("HnCuteDB", 1);
    dbRequest.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains("videos")) {
            db.createObjectStore("videos", { keyPath: "id" });
        }
    };
    dbRequest.onsuccess = (event) => { db = event.target.result; };

    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) supportedMimeType = 'video/webm; codecs=vp9';
        else if (MediaRecorder.isTypeSupported('video/webm')) supportedMimeType = 'video/webm';
        else if (MediaRecorder.isTypeSupported('video/mp4')) supportedMimeType = 'video/mp4';
    } else {
        if (MediaRecorder.isTypeSupported('video/mp4')) supportedMimeType = 'video/mp4';
        else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) supportedMimeType = 'video/webm; codecs=vp9';
    }

    const init = async () => {
        const config = await TimerConfig.load();
        const userRole = sessionStorage.getItem('userRole');
        if (userRole === 'demo') {
            document.getElementById('demoUploadBtn')?.classList.remove('hidden');
            document.getElementById('demoUploadBtn')?.classList.add('flex');
        }

        try {
            const storedTemplate = sessionStorage.getItem('hncuteTemplate');
            if (storedTemplate) {
                const data = JSON.parse(storedTemplate);
                frameName = data.name || frameName;
                if (data.pose) TOTAL_PHOTOS = parseInt(data.pose.replace(/[^0-9]/g, ''), 10) || 4;
                frameSrc = data.frame || '';
                layoutParam = data.layout || '';
                if (data.redirect) redirectTarget = data.redirect;
            }
            
            const storedPhotos = sessionStorage.getItem('hncutePhotos');
            if (storedPhotos) {
                 const parsed = JSON.parse(storedPhotos);
                 if (Array.isArray(parsed) && parsed.length > 0) {
                     displayImages = parsed.slice(0, TOTAL_PHOTOS);
                 }
            }
            
            updatePhotoDisplay();

        } catch(e) { console.error(e); }

        await startCamera();
        startSessionTimer(config.booth || 220);
        updateButtonStates();
    };

    document.getElementById('demoFileInput')?.addEventListener('change', async function(e) {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const reader = new FileReader();
            reader.onload = async (e) => {
                const rawData = e.target.result;
                const compressed = await compressImage(rawData);
                if (displayImages.length < TOTAL_PHOTOS) {
                    displayImages.push(compressed);
                    updatePhotoDisplay();
                    showToast(`Foto diupload (${displayImages.length}/${TOTAL_PHOTOS})`);
                } else {
                    if (isRetakeMode && retakeIndex !== null) {
                        displayImages[retakeIndex] = compressed;
                        isRetakeMode = false;
                        retakeIndex = null;
                        updatePhotoDisplay();
                        showToast("Foto diganti");
                    } else {
                        showToast("Slot foto penuh!");
                    }
                }
            };
            reader.readAsDataURL(file);
            this.value = '';
        }
    });
    
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, 
                audio: false 
            });
            videoEl.srcObject = stream;
            currentStream = stream;
            messageOverlay.classList.add('hidden');
        } catch (err) {
            console.error("Camera Error:", err);
            messageOverlay.textContent = "Gagal mengakses kamera. Pastikan izin diberikan.";
            messageOverlay.classList.remove('hidden');
        }
    };

    const startSessionTimer = (duration) => {
        let timer = duration;
        updateTimerDisplay(timer);
        sessionTimerInterval = setInterval(() => {
            timer--;
            updateTimerDisplay(timer);
            if (timer <= 0) {
                clearInterval(sessionTimerInterval);
                if (timeoutPopup) {
                    window.GSAPManager.openModal(timeoutPopup);
                } else {
                    window.location.href = 'index.html';
                }
            }
        }, 1000);
    };

    const updateTimerDisplay = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (timerDisplay) timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    };
    
    const compressImage = (dataUrl, maxDimension = 1080, quality = 0.8) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width <= maxDimension && height <= maxDimension) { resolve(dataUrl); return; }
                if (width > height) {
                    if (width > maxDimension) { height = Math.round(height * (maxDimension / width)); width = maxDimension; }
                } else {
                    if (height > maxDimension) { width = Math.round(width * (maxDimension / height)); height = maxDimension; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    };

    const captureSingleShot = async (isRetake = false, index = null) => {
        countdownText.classList.remove('hidden');
        const countSpan = document.getElementById('countdown-number');
        const progress = document.getElementById('countdown-progress');
        
        startRecordingVideo();

        for (let i = 3; i > 0; i--) {
            if (countSpan) window.GSAPManager.animateCountdown(countSpan, i);
            if (progress) {
                progress.style.transition = 'none';
                progress.style.strokeDashoffset = '289';
                progress.getBoundingClientRect();
                progress.style.transition = 'stroke-dashoffset 1s linear';
                progress.style.strokeDashoffset = '0';
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        countdownText.classList.add('hidden');
        
        flash.classList.remove('hidden');
        flash.style.animation = 'none';
        flash.offsetHeight;
        flash.style.animation = 'flashAnim 0.2s ease-out forwards';
        
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0);
        
        const rawData = canvas.toDataURL('image/jpeg', 0.95);
        
        await new Promise(r => setTimeout(r, 1000));
        await stopRecordingVideo();
        
        const compressed = await compressImage(rawData);
        
        if (isRetake && index !== null) {
            displayImages[index] = compressed;
            showToast(`Foto #${index+1} diperbarui`);
        } else {
            displayImages.push(compressed);
        }
        
        updatePhotoDisplay();
    };

    const startCaptureSequence = async () => {
        if (isCapturing) return;
        isCapturing = true;
        updateButtonStates(); 

        const startIdx = displayImages.length;
        for (let i = startIdx; i < TOTAL_PHOTOS; i++) {
            if (i > startIdx) await new Promise(r => setTimeout(r, 1000));
            await captureSingleShot();
        }

        isCapturing = false;
        updatePhotoDisplay(); 
    };

    const startRecordingVideo = () => {
        if (!currentStream) return;
        currentClipChunks = [];
        try {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            mediaRecorder = new MediaRecorder(currentStream, { 
                mimeType: supportedMimeType, 
                videoBitsPerSecond: 2500000
            });
            mediaRecorder.ondataavailable = e => { if(e.data && e.data.size > 0) currentClipChunks.push(e.data); };
            mediaRecorder.onerror = (e) => { console.warn("MediaRecorder Error:", e); };
            mediaRecorder.start(1000);
        } catch(e) { console.error("MediaRecorder Start Error", e); }
    };

    const stopRecordingVideo = () => {
        return new Promise((resolve) => {
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                resolve();
                return;
            }

            const safetyTimeout = setTimeout(() => {
                console.warn("MediaRecorder stop timeout - forcing resolve");
                resolve();
            }, 2000);

            mediaRecorder.onstop = () => {
                clearTimeout(safetyTimeout);
                try {
                    const blob = new Blob(currentClipChunks, { type: supportedMimeType });
                    const idx = isRetakeMode && retakeIndex !== null ? retakeIndex : displayImages.length;
                    if (blob.size > 0) {
                        recordedClips[idx] = blob;
                        console.log(`Clip ${idx} saved: ${(blob.size/1024).toFixed(2)} KB`);
                    } else {
                        console.warn(`Clip ${idx} is empty`);
                    }
                } catch (e) {
                    console.error("Error saving clip:", e);
                }
                resolve();
            };

            try {
                mediaRecorder.stop();
            } catch (e) {
                clearTimeout(safetyTimeout);
                console.error("Error stopping recorder:", e);
                resolve();
            }
        });
    };
    
    const updatePhotoDisplay = async () => {
        if (!frameSrc) return;

        frameOverlay.src = frameSrc;
        frameOverlay.classList.remove('hidden');
        
        let holes = [];
        let naturalW = 1000;
        let naturalH = 1000;

        try {
            const img = await window.ImageAnalyzer._loadImage(frameSrc);
            naturalW = img.naturalWidth;
            naturalH = img.naturalHeight;
            const aspect = naturalW / naturalH;
            templateContainer.style.aspectRatio = `${aspect}`;
            holes = await window.ImageAnalyzer.getHoleData(frameSrc, TOTAL_PHOTOS);
        } catch (e) {
            console.error("Hole analysis failed", e);
        }

        photosGrid.innerHTML = '';
        photosGrid.className = `absolute inset-0`; 
        photosGrid.style.display = 'block';

        for (let i = 0; i < TOTAL_PHOTOS; i++) {
            const src = displayImages[i];
            const isFilled = !!src;
            const isSessionComplete = displayImages.length >= TOTAL_PHOTOS && !isCapturing;
            
            const hole = holes[i];
            const slot = document.createElement('div');
            
            if (hole) {
                const leftPct = (hole.x / naturalW) * 100;
                const topPct = (hole.y / naturalH) * 100;
                const widthPct = (hole.width / naturalW) * 100;
                const heightPct = (hole.height / naturalH) * 100;
                
                slot.style.position = 'absolute';
                slot.style.left = `${leftPct}%`;
                slot.style.top = `${topPct}%`;
                slot.style.width = `${widthPct}%`;
                slot.style.height = `${heightPct}%`;
            } else {
                slot.style.display = 'none';
            }

            slot.className += ` overflow-hidden flex items-center justify-center`;
            
            if (isFilled) {
                slot.className += " bg-black";
                slot.innerHTML = `
                    <img src="${src}" class="w-full h-full object-cover">
                    ${ (isSessionComplete || (isRetakeMode && retakeIndex === i)) ? `
                    <button onclick="window.triggerRetake(${i})" 
                        class="absolute top-1 right-1 w-6 h-6 md:w-8 md:h-8 bg-[#FFFBC4] border border-[#B2AE81] rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-all z-20 hover:bg-[#F0F0E0] cursor-pointer pointer-events-auto">
                        <span class="iconify text-sm text-[#B2AE81]" data-icon="solar:restart-bold"></span>
                    </button>
                    ` : ''}
                `;
            } else {
                slot.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center border-2 border-dashed border-[#B2AE81] bg-[#CFCB98]/20 rounded-lg box-border scale-95 transition-transform">
                        <span class="font-zoika text-[#B2AE81] text-xl md:text-3xl">${i + 1}</span>
                    </div>
                `;
            }
            photosGrid.appendChild(slot);
        }
        
        sessionStorage.setItem('hncutePhotos', JSON.stringify(displayImages));
        updateButtonStates();
    };

    const updateButtonStates = () => {
        const isFull = displayImages.length >= TOTAL_PHOTOS;
        const btnText = actionBtn.querySelector('span:not(.iconify)');
        const btnIcon = actionBtn.querySelector('.iconify');
        
        if (isRetakeMode) {
            btnText.textContent = isCapturing ? 'Memotret...' : 'Ambil Ulang';
            actionBtn.style.backgroundColor = '#fb923c'; 
            actionBtn.classList.add('text-white');
            actionBtn.classList.remove('text-[#FFFBC4]');
            actionBtn.disabled = isCapturing;
        } else {
            actionBtn.classList.add('text-[#FFFBC4]');
            actionBtn.classList.remove('text-white');
            
            if (isFull) {
                btnText.textContent = 'Lanjut';
                btnIcon.classList.add('hidden');
                actionBtn.style.backgroundColor = '#B2AE81'; 
                actionBtn.disabled = false;
            } else {
                btnIcon.classList.remove('hidden');
                btnText.textContent = isCapturing ? 'Memotret...' : 'Mulai Foto';
                btnIcon.setAttribute('data-icon', 'solar:camera-bold');
                actionBtn.style.backgroundColor = '#B2AE81';
                actionBtn.disabled = isCapturing;
            }
        }
    };

    window.triggerRetake = (idx) => {
        isRetakeMode = true;
        retakeIndex = idx;
        updateButtonStates();
        showToast(`Mode Retake: Foto #${idx+1}`);
        updatePhotoDisplay();
    };

    const handleMainAction = async () => {
        const isFull = displayImages.length >= TOTAL_PHOTOS;
        
        if (isRetakeMode) {
            isCapturing = true;
            updateButtonStates();
            await captureSingleShot(true, retakeIndex);
            isCapturing = false;
            isRetakeMode = false;
            retakeIndex = null;
            updatePhotoDisplay();
            return;
        }

        if (isFull) {
            try {
                if (recordedClips.length > 0) {
                    const validClips = recordedClips.filter(b => b);
                    if (validClips.length > 0) {
                        const transaction = db.transaction(["videos"], "readwrite");
                        const store = transaction.objectStore("videos");
                        store.put({ id: "liveModeVideo", clips: validClips, timestamp: Date.now() });
                        sessionStorage.setItem('isLiveMode', 'true');
                        sessionStorage.setItem('isVideoMirrored', 'true');
                    }
                }
                
                sessionStorage.setItem('hncutePhotos', JSON.stringify(displayImages));
                sessionStorage.setItem('poseCount', TOTAL_PHOTOS);
                sessionStorage.setItem('selectedFrame', frameSrc);
                sessionStorage.setItem('selectedLayout', layoutParam);
                
                const sessions = JSON.parse(localStorage.getItem('hncuteSessions') || '[]');
                sessions.unshift({
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    templateName: frameName,
                    frameSrc: frameSrc,
                    poseCount: TOTAL_PHOTOS,
                    photos: displayImages
                });
                localStorage.setItem('hncuteSessions', JSON.stringify(sessions.slice(0, 5)));

                const targetUrl = redirectTarget.endsWith('.html') ? redirectTarget : redirectTarget + '.html';
                if(window.smoothNavigate) window.smoothNavigate(targetUrl);
                else window.location.href = targetUrl;

            } catch(e) {
                console.error(e);
                alert("Gagal menyimpan sesi: " + e.message);
            }
        } else {
            await startCaptureSequence();
        }
    };

    actionBtn.addEventListener('click', handleMainAction);

    const showToast = (msg) => {
        window.GSAPManager.showToast(toast, msg);
    };

    init();
});