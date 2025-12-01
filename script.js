// DOM Elements
const audioInput = document.getElementById('audioInput');
const fileNameDisplay = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const durationInput = document.getElementById('durationInput');
const dropZone = document.getElementById('dropZone');

// 1. تحسين تجربة رفع الملف (UI Feedback)
audioInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        fileNameDisplay.innerHTML = `<span class="text-blue-400 font-bold">${this.files[0].name}</span>`;
        dropZone.classList.add('border-blue-500', 'bg-gray-700');
    }
});

// 2. دالة المعالجة الرئيسية
processBtn.addEventListener('click', async () => {
    // Validation using SweetAlert2
    if (!audioInput.files.length) {
        Swal.fire({
            icon: 'error',
            title: 'عفواً..',
            text: 'يجب اختيار ملف صوتي أولاً!',
            background: '#1f2937',
            color: '#fff',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    const targetDuration = parseFloat(durationInput.value);
    
    // Loading State
    processBtn.disabled = true;
    processBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري العمل...`;

    // استخدام setTimeout للسماح للواجهة بالتحديث
    setTimeout(async () => {
        try {
            const file = audioInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // فك التشفير
            const originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            // إعداد الـ Offline Context
            const offlineCtx = new OfflineAudioContext(
                originalBuffer.numberOfChannels,
                targetDuration * originalBuffer.sampleRate,
                originalBuffer.sampleRate
            );

            // خوارزمية التكرار الذكية
            let currentTime = 0;
            while (currentTime < targetDuration) {
                const source = offlineCtx.createBufferSource();
                source.buffer = originalBuffer;
                source.connect(offlineCtx.destination);
                source.start(currentTime);
                currentTime += originalBuffer.duration;
            }

            // الريندر
            const renderedBuffer = await offlineCtx.startRendering();
            
            // التحويل لملف WAV
            const wavBlob = bufferToWave(renderedBuffer, targetDuration * originalBuffer.sampleRate);
            const url = URL.createObjectURL(wavBlob);

            // نجاح العملية - عرض نافذة التحميل
            Swal.fire({
                icon: 'success',
                title: 'تمت العملية بنجاح!',
                text: `تم تجهيز ملف مدته ${targetDuration} ثانية`,
                background: '#1f2937',
                color: '#fff',
                showConfirmButton: false,
                html: `
                    <a href="${url}" download="edited_audio.wav" class="inline-block mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        <i class="fa-solid fa-download ml-2"></i> تحميل الملف الآن
                    </a>
                `
            });

        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'حدث خطأ تقني',
                text: error.message,
                background: '#1f2937',
                color: '#fff'
            });
        } finally {
            processBtn.disabled = false;
            processBtn.innerHTML = `<span>بدء المعالجة</span> <i class="fa-solid fa-bolt"></i>`;
        }
    }, 100);
});

// Helper Function: Convert AudioBuffer to WAV
function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0, pos = 0;

    // WAV Header Boilerplate
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164);
    setUint32(length - pos - 4);

    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

    while(pos < len) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
            view.setInt16(44 + offset, sample, true); offset += 2;
        }
        pos++;
    }
    return new Blob([buffer], {type: "audio/wav"});
}