// DOM Elements
const analyzeButton = document.getElementById("analyzeButton");
const imageInput = document.getElementById("imageInput");
const uploadNotification = document.getElementById("uploadNotification");
const loadingSpinner = document.getElementById("loadingSpinner");
const uploadedCanvas = document.getElementById("uploadedCanvas");
const processedCanvas = document.getElementById("processedCanvas");
const uploadedCaption = document.getElementById("uploadedCaption");
const processedCaption = document.getElementById("processedCaption");
const objectDetails = document.getElementById("objectDetails");
const downloadButton = document.getElementById("downloadButton");

// API Authentication and Base URLs
const AUTH_TOKEN = "Bearer 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";
const apiKey = "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";
const apiBase = "https://api.groq.com/openai/v1";

/**
 * Utility function to call Hugging Face APIs.
 * @param {string} url - API endpoint.
 * @param {object} data - Request payload.
 * @returns {Promise} - API response as JSON.
 */
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

/**
 * Add particle effects to the page for a dynamic visual experience.
 */
document.addEventListener("DOMContentLoaded", () => {
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

/**
 * Generate a random color in HSL format.
 */
function getRandomColor() {
    return `hsl(${Math.random() * 360}, 70%, 60%)`;
}

/**
 * Event listener for image upload, displaying notification.
 */
imageInput.addEventListener("change", () => {
    uploadNotification.style.display = imageInput.files.length > 0 ? "block" : "none";
});

/**
 * Call the chatbot API to process a message.
 * @param {string} message - The message to send to the chatbot.
 * @returns {Promise<string>} - The chatbot's response.
 */
async function getChatbotResponse(message) {
    const url = `${apiBase}/chat/completions`;
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
    };

    const body = JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
            { role: "system", content: "Describe the scene given by the user in one statement." },
            { role: "user", content: message },
        ],
    });

    try {
        const response = await fetch(url, { method: "POST", headers, body });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Error:", error);
        return "Error: Could not fetch response from the chatbot.";
    }
}

/**
 * Main function to analyze an uploaded image and display results.
 */
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
            // Draw the uploaded image on the canvas
            const ctxUploaded = uploadedCanvas.getContext("2d");
            const uploadedImage = new Image();
            uploadedImage.onload = () => {
                uploadedCanvas.width = uploadedImage.width;
                uploadedCanvas.height = uploadedImage.height;
                ctxUploaded.drawImage(uploadedImage, 0, 0);
            };
            uploadedImage.src = imageData;

            // Convert image data to array buffer for API processing
            const arrayBuffer = Uint8Array.from(atob(imageData.split(",")[1]), (c) => c.charCodeAt(0));

            // Call Hugging Face Object Detection API
            const objectResponse = await queryHuggingFaceAPI(
                "https://api-inference.huggingface.co/models/facebook/detr-resnet-50",
                arrayBuffer
            );

            const ctxProcessed = processedCanvas.getContext("2d");
            const processedImage = new Image();
            processedImage.onload = async () => {
                processedCanvas.width = processedImage.width;
                processedCanvas.height = processedImage.height;
                ctxProcessed.drawImage(processedImage, 0, 0);

                // Categorize detected objects and assign colors
                const categories = {};
                objectResponse.forEach(({ label }) => {
                    if (!categories[label]) {
                        categories[label] = { count: 0, color: getRandomColor() };
                    }
                    categories[label].count++;
                });

                // Draw bounding boxes and labels
                objectResponse.forEach(({ label, score, box }) => {
                    const color = categories[label].color;
                    ctxProcessed.strokeStyle = color;
                    ctxProcessed.lineWidth = 2;
                    ctxProcessed.strokeRect(box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
                    ctxProcessed.fillStyle = color;
                    ctxProcessed.font = "16px Arial";
                    ctxProcessed.fillText(`${label} (${(score * 100).toFixed(1)}%)`, box.xmin, box.ymin - 5);
                });

                // Display object details and captions
                const objectDetailsHTML = Object.entries(categories)
                    .map(([label]) => `${label}`)
                    .join(", ");

                const captionResponse = await queryHuggingFaceAPI(
                    "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
                    arrayBuffer
                );

                const caption = captionResponse[0]?.generated_text || "No caption";

                // Call chatbot for a refined caption
                const chatbotInput = `The scene is: "${caption}" and object details are: ${objectDetailsHTML}.`;
                const chatbotResponse = await getChatbotResponse(chatbotInput);

                uploadedCaption.textContent = "Uploaded Image: Original view.";
                processedCaption.innerHTML = `
                    <strong>Detected Image Caption:</strong> ${chatbotResponse}
                `;

                // Ensure the spinner is hidden only after caption is visible
                processedCaption.addEventListener("load", () => {
                    loadingSpinner.style.display = "none";
                });

                // Speak the chatbot response
                speakCaption(chatbotResponse);

                // Set up download button
                downloadButton.onclick = () => {
                    const link = document.createElement("a");
                    link.download = "processed_image.png";
                    link.href = processedCanvas.toDataURL();
                    link.click();
                };
            };

            processedImage.src = imageData;
        } catch (error) {
            console.error(error);
            alert("An error occurred during processing.");
        }
    };

    reader.readAsDataURL(file);
}

/**
 * Text-to-Speech function to speak the detected caption with a soft English voice.
 * @param {string} text - Text to speak.
 */
function speakCaption(text) {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    
    // Find an English voice (regardless of country)
    const englishVoice = voices.find((voice) => voice.lang.startsWith("en"));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en"; // English language
    utterance.voice = englishVoice || voices[0]; // Default to the first available voice if no English voice is found
    
    // Adjust voice characteristics for a soft voice
    utterance.volume = 0.9; // Lower the volume slightly for a softer sound (0 to 1)
    utterance.rate = 0.9; // Reduce the speech rate slightly for a softer, slower delivery (0.1 to 10)
    utterance.pitch = 0.8; // Lower the pitch for a softer, more relaxed tone (0 to 2)
    
    synth.speak(utterance);
}

// Attach event listener to the analyze button
analyzeButton.addEventListener("click", analyzeImage);
