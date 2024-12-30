const analyzeButton = document.getElementById("analyzeButton");
const imageInput = document.getElementById("imageInput");
const uploadNotification = document.getElementById("uploadNotification");
const loadingSpinner = document.getElementById("loadingSpinner");
const uploadedCanvas = document.getElementById("uploadedCanvas");
const processedCanvas = document.getElementById("processedCanvas");
const uploadedCaption = document.getElementById("uploadedCaption");
const processedCaption = document.getElementById("processedCaption");
const downloadButton = document.getElementById("downloadButton");

const AUTH_TOKEN = "Bearer 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";

async function queryHuggingFaceAPI(url, data) {
    const response = await fetch(url, {
        headers: {
            Authorization: AUTH_TOKEN,
            "Content-Type": "application/json",
        },
        method: "POST",
        body: data,
    });
    return response.json();
}

document.addEventListener("DOMContentLoaded", () => {
    // Particle Effect
    const particlesContainer = document.createElement("div");
    particlesContainer.className = "particles";
    document.body.appendChild(particlesContainer);

    const numberOfParticles = 50;
    for (let i = 0; i < numberOfParticles; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particle.style.width = `${Math.random() * 8 + 2}px`;
        particle.style.height = particle.style.width; // Ensure particle is a circle
        particlesContainer.appendChild(particle);
    }
});

imageInput.addEventListener("change", () => {
    if (imageInput.files.length > 0) {
        uploadNotification.style.display = "block";
    } else {
        uploadNotification.style.display = "none";
    }
});

async function analyzeImage() {
    const file = imageInput.files[0];
    if (!file) {
        alert("Please upload an image!");
        return;
    }

    uploadNotification.style.display = "none";
    loadingSpinner.style.display = "block";

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;

        try {
            // Display uploaded image
            const ctxUploaded = uploadedCanvas.getContext("2d");
            const uploadedImage = new Image();
            uploadedImage.onload = () => {
                uploadedCanvas.width = uploadedImage.width;
                uploadedCanvas.height = uploadedImage.height;
                ctxUploaded.drawImage(uploadedImage, 0, 0);
            };
            uploadedImage.src = imageData;

            // Query object detection API
            const arrayBuffer = Uint8Array.from(atob(imageData.split(",")[1]), (c) => c.charCodeAt(0));
            const objectResponse = await queryHuggingFaceAPI(
                "https://api-inference.huggingface.co/models/facebook/detr-resnet-50",
                arrayBuffer
            );

            const ctxProcessed = processedCanvas.getContext("2d");
            const processedImage = new Image();
            processedImage.onload = () => {
                processedCanvas.width = processedImage.width;
                processedCanvas.height = processedImage.height;
                ctxProcessed.drawImage(processedImage, 0, 0);

                // Draw bounding boxes and labels
                objectResponse.forEach(({ label, score, box }) => {
                    ctxProcessed.strokeStyle = "red";
                    ctxProcessed.lineWidth = 2;
                    ctxProcessed.strokeRect(box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
                    ctxProcessed.fillStyle = "red";
                    ctxProcessed.font = "16px Arial";
                    ctxProcessed.fillText(`${label} (${(score * 100).toFixed(1)}%)`, box.xmin, box.ymin - 5);
                });
            };
            processedImage.src = imageData;

            // Query image captioning API
            const captionResponse = await queryHuggingFaceAPI(
                "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
                arrayBuffer
            );

            const captionText = captionResponse[0]?.generated_text || "No caption";
            uploadedCaption.textContent = "Uploaded Image: Original view.";
            processedCaption.textContent = `Detected Image Caption: "${captionText}"`;

            // **Speak the caption using Web Speech API**
            speakCaption(captionText);

            // Enable download button
            downloadButton.onclick = () => {
                const link = document.createElement("a");
                link.download = "processed_image.png";
                link.href = processedCanvas.toDataURL();
                link.click();
            };
        } catch (error) {
            console.error(error);
            alert("An error occurred during processing.");
        } finally {
            loadingSpinner.style.display = "none";
        }
    };

    reader.readAsDataURL(file);
}

// Web Speech API: Function to speak the detected caption
function speakCaption(caption) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(caption);
    utterance.lang = "en-US";
    utterance.volume = 1; // Volume (0 to 1)
    utterance.rate = 1; // Speech rate (0.1 to 10)
    utterance.pitch = 1; // Pitch (0 to 2)
    synth.speak(utterance);
}

analyzeButton.addEventListener("click", analyzeImage);