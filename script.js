document.addEventListener('DOMContentLoaded', () => {

    const baseResEl = document.getElementById('baseRes');
    const targetResEl = document.getElementById('targetRes');
    const manualScaleEl = document.getElementById('manualScale');
    const inputArea = document.getElementById('inputStr');
    const outputArea = document.getElementById('outputStr');
    const processBtn = document.getElementById('processBtn');
    const copyBtn = document.getElementById('copyBtn');

    // Automatically update the multiplier when dropdowns change
    function updateFactor() {
        const base = parseFloat(baseResEl.value);
        const target = parseFloat(targetResEl.value);
        const factor = (target / base).toFixed(3);
        manualScaleEl.value = factor;
    }

    function runScaler() {
        const input = inputArea.value.trim();
        const scale = parseFloat(manualScaleEl.value);
        
        if (!input) return alert("Please paste an input string first.");
        if (isNaN(scale)) return alert("Invalid scale factor.");

        try {
            // Clean DelvUI wrappers
            let cleanInput = input.replace(/^\|+/, '').replace(/\|+$/, '');
            const parts = cleanInput.split("||");
            
            const scaledParts = parts.map((part, index) => {
                const base64Data = part.trim().replace(/[\n\r\s|]/g, "");
                if (!base64Data) return null;

                try {
                    // 1. Decode
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    // 2. Decompress
                    const decompressed = pako.inflate(bytes, { raw: true });
                    const jsonStr = new TextDecoder().decode(decompressed);
                    let config = JSON.parse(jsonStr);

                    // 3. Scale logic (Recursive)
                    scaleRecursive(config, scale);

                    // 4. Re-compress
                    const newJsonStr = JSON.stringify(config);
                    const compressed = pako.deflate(newJsonStr, { raw: true });
                    
                    // 5. Encode
                    return uint8ToBase64(compressed);
                } catch (e) {
                    console.warn(`Part ${index} failed:`, e);
                    return null;
                }
            }).filter(p => p !== null);

            if (scaledParts.length === 0) throw new Error("Could not find valid config data.");

            outputArea.value = `|||${scaledParts.join("||")}||`;
            
            // Visual feedback on the button
            const originalText = processBtn.innerText;
            processBtn.innerText = "✓ Scaled Successfully";
            processBtn.style.background = "var(--success)";
            setTimeout(() => {
                processBtn.innerText = originalText;
                processBtn.style.background = "var(--accent)";
            }, 2000);

        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
    }

    function copyToClipboard() {
        if (!outputArea.value) return;
        
        outputArea.select();
        try {
            navigator.clipboard.writeText(outputArea.value);
            const originalText = copyBtn.innerText;
            copyBtn.innerText = "Copied!";
            setTimeout(() => copyBtn.innerText = originalText, 2000);
        } catch (err) {
            document.execCommand('copy');
            alert("Copied to clipboard!");
        }
    }

    // Helper: Large binary to Base64
    function uint8ToBase64(uint8Array) {
        let binary = '';
        const len = uint8Array.byteLength;
        const chunk_size = 0x8000; 
        for (let i = 0; i < len; i += chunk_size) {
            binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunk_size));
        }
        return btoa(binary);
    }

    // Main Recursive Scaling Logic
    function scaleRecursive(obj, factor) {
        if (Array.isArray(obj)) {
            obj.forEach(item => scaleRecursive(item, factor));
        } else if (obj !== null && typeof obj === 'object') {
            const isVector4 = obj["$type"] && obj["$type"].includes("Vector4");
            
            for (let key in obj) {
                const val = obj[key];

                // Keys we want to scale
                const scaleKeys = ["X", "Y", "Thickness", "Thickess", "Offset", "Height", "Width", "Range", "AdditionalRange", "Velocity"];
                
                if (scaleKeys.includes(key) && typeof val === 'number' && !isVector4) {
                    const ignoreKeys = ["Corner", "FillDirection", "BlendMode", "StrataLevel", "Version", "Style", "FrameAnchor", "Anchor", "Strata"];
                    
                    if (!ignoreKeys.includes(key)) {
                        const newVal = val * factor;
                        // Prevent "target of invocation" error by maintaining Integer types
                        obj[key] = Number.isInteger(val) ? Math.round(newVal) : Math.round(newVal * 100) / 100;
                    }
                } 
                // Font ID Scaling
                else if (key === "FontID" && typeof val === "string") {
                    obj[key] = val.replace(/_(\d+)/, (match, p1) => "_" + Math.round(parseInt(p1) * factor));
                } 
                else if (typeof val === 'object') {
                    scaleRecursive(val, factor);
                }
            }
        }
    }

    // Initialize Listeners
    baseResEl.addEventListener('change', updateFactor);
    targetResEl.addEventListener('change', updateFactor);
    processBtn.addEventListener('click', runScaler);
    copyBtn.addEventListener('click', copyToClipboard);

    updateFactor();
});