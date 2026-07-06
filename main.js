// ========================================
// Liquid Canvas - 流光画板
// 边缘光晕实时响应画笔颜色
// ========================================

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const canvasContainer = document.getElementById('canvasContainer');
const canvasWrapper = document.getElementById('canvasWrapper');

// 状态
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#0f172a';
let currentSize = 5;
let currentOpacity = 1;
let zoomLevel = 1;

// 形状绘制
let startPos = null;
let tempCanvas = null;
let lastPos = null;

// 历史记录
let history = [];
let historyStep = -1;
const MAX_HISTORY = 50;

// 工具名称
const toolNames = {
    pen: '画笔工具',
    eraser: '橡皮擦',
    line: '直线工具',
    rect: '矩形工具',
    circle: '圆形工具',
    fill: '填充工具',
    picker: '取色器'
};

// ========================================
// 颜色处理工具
// ========================================

// 将 hex 转为 RGB 对象
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// 将 RGB 转为 HSL
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

// 将 HSL 转为 RGB
function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// 生成光晕颜色（基于主色的变体）
function generateGlowColors(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    // 主光晕：保持色相，提高亮度
    const primary = hslToRgb(hsl.h, Math.min(hsl.s, 80), Math.min(hsl.l + 20, 85));
    
    // 次光晕：色相偏移 +30°
    const secondary = hslToRgb((hsl.h + 30) % 360, Math.min(hsl.s, 70), Math.min(hsl.l + 10, 75));
    
    // 第三光晕：色相偏移 -20°
    const tertiary = hslToRgb((hsl.h - 20 + 360) % 360, Math.min(hsl.s, 60), Math.min(hsl.l + 15, 70));
    
    // 第四光晕：色相偏移 +60°，更淡
    const quaternary = hslToRgb((hsl.h + 60) % 360, Math.min(hsl.s, 50), Math.min(hsl.l + 5, 65));
    
    return {
        primary: `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.5)`,
        secondary: `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.4)`,
        tertiary: `rgba(${tertiary.r}, ${tertiary.g}, ${tertiary.b}, 0.3)`,
        quaternary: `rgba(${quaternary.r}, ${quaternary.g}, ${quaternary.b}, 0.25)`
    };
}

// 生成强调色
function generateAccentColors(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    const light = hslToRgb(hsl.h, Math.min(hsl.s, 90), Math.min(hsl.l + 30, 90));
    const lighter = hslToRgb(hsl.h, Math.min(hsl.s, 80), Math.min(hsl.l + 40, 95));
    
    return {
        accent: `rgb(${light.r}, ${light.g}, ${light.b})`,
        accentLight: `rgb(${lighter.r}, ${lighter.g}, ${lighter.b})`
    };
}

// ========================================
// 更新全局光晕颜色
// ========================================
function updateAmbientGlow(hex) {
    const glowColors = generateGlowColors(hex);
    const accentColors = generateAccentColors(hex);
    const root = document.documentElement;
    
    // 更新 CSS 变量
    root.style.setProperty('--glow-primary', glowColors.primary);
    root.style.setProperty('--glow-secondary', glowColors.secondary);
    root.style.setProperty('--glow-tertiary', glowColors.tertiary);
    root.style.setProperty('--glow-quaternary', glowColors.quaternary);
    root.style.setProperty('--accent-blue', accentColors.accent);
    root.style.setProperty('--accent-purple', accentColors.accentLight);
    
    // 更新 Logo 图标
    const logoIcon = document.getElementById('logoIcon');
    logoIcon.style.background = `linear-gradient(135deg, ${accentColors.accent}, ${accentColors.accentLight})`;
    
    // 更新面板装饰线
    document.querySelectorAll('.panel-accent').forEach(el => {
        el.style.background = `linear-gradient(90deg, ${accentColors.accent}, ${accentColors.accentLight})`;
        el.style.boxShadow = `0 0 10px ${glowColors.primary}`;
    });
    
    // 更新状态指示器
    const indicator = document.getElementById('statusIndicator');
    indicator.style.background = accentColors.accent;
    indicator.style.boxShadow = `0 0 8px ${glowColors.primary}`;
    
    // 更新滑块填充
    document.querySelectorAll('.slider-fill').forEach(el => {
        el.style.background = `linear-gradient(90deg, ${accentColors.accent}, ${accentColors.accentLight})`;
        el.style.boxShadow = `0 0 8px ${glowColors.primary}`;
    });
    
    // 更新笔刷预览
    const preview = document.getElementById('brushPreview');
    preview.style.background = accentColors.accent;
    preview.style.boxShadow = `0 0 25px ${glowColors.primary}, 0 0 50px ${glowColors.secondary}`;
    
    // 更新笔刷预览背景
    document.querySelector('.brush-preview::before') && 
        document.querySelector('.brush-preview').style.setProperty('--preview-glow', glowColors.primary);
    
    // 更新激活的工具按钮
    document.querySelectorAll('.tool-btn.active, .sidebar-tool.active').forEach(btn => {
        btn.style.boxShadow = `0 0 0 1px ${glowColors.primary}, 0 4px 20px ${glowColors.primary}`;
    });
    
    // 更新画布容器光晕
    canvasWrapper.style.boxShadow = `inset 0 0 60px ${glowColors.primary}, 0 0 0 1px var(--glass-border)`;
    
    // 更新画布本身光晕
    canvas.style.boxShadow = `
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05),
        0 0 40px ${glowColors.primary}
    `;
    
    // 更新边缘粒子颜色
    updateEdgeParticles(hex);
}

// ========================================
// 边缘粒子效果
// ========================================
function createEdgeParticles() {
    const container = document.getElementById('edgeParticles');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'edge-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = (Math.random() * 6 + 2) + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDuration = (Math.random() * 10 + 8) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

function updateEdgeParticles(hex) {
    const glowColors = generateGlowColors(hex);
    const particles = document.querySelectorAll('.edge-particle');
    
    particles.forEach((p, i) => {
        const colors = [glowColors.primary, glowColors.secondary, glowColors.tertiary, glowColors.quaternary];
        const color = colors[i % colors.length];
        p.style.background = color;
        p.style.boxShadow = `0 0 15px ${color}`;
    });
}

// ========================================
// 初始化
// ========================================
function init() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 1200;
    const displayHeight = 800;
    
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    saveHistory();
    updateUI();
    bindEvents();
    updateSliderFills();
    createEdgeParticles();
    
    // 初始化光晕颜色
    updateAmbientGlow(currentColor);
}

// ========================================
// 坐标获取
// ========================================
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (window.devicePixelRatio || 1) / rect.width;
    const scaleY = canvas.height / (window.devicePixelRatio || 1) / rect.height;
    
    return {
        x: (e.clientX - rect.left) * scaleX / zoomLevel,
        y: (e.clientY - rect.top) * scaleY / zoomLevel
    };
}

// ========================================
// 历史记录
// ========================================
function saveHistory() {
    if (historyStep < history.length - 1) {
        history = history.slice(0, historyStep + 1);
    }
    
    history.push(canvas.toDataURL('image/png'));
    
    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyStep++;
    }
    
    updateHistoryUI();
}

function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreHistory();
        showToast('已撤销');
    }
}

function redo() {
    if (historyStep < history.length - 1) {
        historyStep++;
        restoreHistory();
        showToast('已重做');
    }
}

function restoreHistory() {
    const img = new Image();
    img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = canvas.width / dpr;
        const displayHeight = canvas.height / dpr;
        
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    };
    img.src = history[historyStep];
    updateHistoryUI();
}

// ========================================
// 快照管理
// ========================================
function saveSnapshot() {
    tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
}

function restoreSnapshot() {
    if (tempCanvas) {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = canvas.width / dpr;
        const displayHeight = canvas.height / dpr;
        
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
    }
}

// ========================================
// 绘制函数
// ========================================
function drawLine(from, to) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function drawRect(from, to) {
    const width = to.x - from.x;
    const height = to.y - from.y;
    ctx.strokeRect(from.x, from.y, width, height);
}

function drawCircle(from, to) {
    const radius = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function floodFill(startX, startY, fillColor) {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    
    const pixelX = Math.floor(startX * dpr);
    const pixelY = Math.floor(startY * dpr);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const startIdx = (pixelY * width + pixelX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];
    
    const r = parseInt(fillColor.slice(1, 3), 16);
    const g = parseInt(fillColor.slice(3, 5), 16);
    const b = parseInt(fillColor.slice(5, 7), 16);
    const a = Math.round(currentOpacity * 255);
    
    if (startR === r && startG === g && startB === b && startA === a) return;
    
    const stack = [[pixelX, pixelY]];
    const visited = new Set();
    const tolerance = 32;
    
    function colorMatch(idx) {
        return Math.abs(data[idx] - startR) < tolerance &&
               Math.abs(data[idx + 1] - startG) < tolerance &&
               Math.abs(data[idx + 2] - startB) < tolerance &&
               Math.abs(data[idx + 3] - startA) < tolerance;
    }
    
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        
        if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) continue;
        
        const idx = (y * width + x) * 4;
        if (!colorMatch(idx)) continue;
        
        visited.add(key);
        
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
        
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function pickColor(x, y) {
    const dpr = window.devicePixelRatio || 1;
    const pixelX = Math.floor(x * dpr);
    const pixelY = Math.floor(y * dpr);
    
    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    return '#' + [pixel[0], pixel[1], pixel[2]].map(v => 
        v.toString(16).padStart(2, '0')
    ).join('');
}

// ========================================
// 样式设置
// ========================================
function setStrokeStyle() {
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = hexToRgba(currentColor, currentOpacity);
    ctx.fillStyle = hexToRgba(currentColor, currentOpacity);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ========================================
// 事件绑定
// ========================================
function bindEvents() {
    canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
    canvas.addEventListener('mousemove', handleMouseMove, { passive: false });
    canvas.addEventListener('mouseup', handleMouseUp, { passive: false });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: false });
    canvas.addEventListener('dragstart', (e) => e.preventDefault());
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    bindToolbarEvents();
    bindPanelEvents();
    document.addEventListener('keydown', handleKeyDown);
}

function handleMouseDown(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getCanvasPos(e);
    lastPos = pos;
    startPos = pos;
    
    setStrokeStyle();
    
    if (currentTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
        ctx.stroke();
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    } else if (['line', 'rect', 'circle'].includes(currentTool)) {
        saveSnapshot();
    } else if (currentTool === 'fill') {
        floodFill(pos.x, pos.y, currentColor);
        isDrawing = false;
        saveHistory();
    } else if (currentTool === 'picker') {
        const color = pickColor(pos.x, pos.y);
        currentColor = color;
        updateColorUI();
        updateAmbientGlow(currentColor);
        isDrawing = false;
        showToast(`已选取颜色 ${color}`);
    }
    
    updateStatus('drawing');
}

function handleMouseMove(e) {
    const pos = getCanvasPos(e);
    
    document.getElementById('coords').textContent = 
        `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}`;
    
    if (!isDrawing) return;
    
    if (currentTool === 'pen') {
        if (lastPos) {
            const midX = (lastPos.x + pos.x) / 2;
            const midY = (lastPos.y + pos.y) / 2;
            ctx.quadraticCurveTo(lastPos.x, lastPos.y, midX, midY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(midX, midY);
        }
        lastPos = pos;
    } else if (currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos = pos;
    } else if (['line', 'rect', 'circle'].includes(currentTool) && startPos) {
        restoreSnapshot();
        setStrokeStyle();
        drawShape(currentTool, startPos, pos);
    }
}

function handleMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    const pos = getCanvasPos(e);
    
    if (currentTool === 'pen') {
        if (lastPos) {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'source-over';
    } else if (['line', 'rect', 'circle'].includes(currentTool) && startPos) {
        restoreSnapshot();
        setStrokeStyle();
        drawShape(currentTool, startPos, pos);
        startPos = null;
        tempCanvas = null;
    }
    
    lastPos = null;
    saveHistory();
    updateStatus('ready');
}

function handleMouseLeave() {
    if (isDrawing) {
        if (['line', 'rect', 'circle'].includes(currentTool)) {
            restoreSnapshot();
            startPos = null;
            tempCanvas = null;
        }
        isDrawing = false;
        lastPos = null;
        updateStatus('ready');
    }
}

function drawShape(tool, from, to) {
    ctx.beginPath();
    if (tool === 'line') {
        drawLine(from, to);
    } else if (tool === 'rect') {
        drawRect(from, to);
    } else if (tool === 'circle') {
        drawCircle(from, to);
    }
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchEnd(e) {
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
}

// ========================================
// UI 事件
// ========================================
function bindToolbarEvents() {
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);
    
    document.getElementById('btn-new').addEventListener('click', () => {
        if (confirm('确定要新建画布吗？当前内容将丢失。')) {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = canvas.width / dpr;
            const displayHeight = canvas.height / dpr;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, displayWidth, displayHeight);
            history = [];
            historyStep = -1;
            saveHistory();
            showToast('新建画布');
        }
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm('确定要清空画布吗？')) {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = canvas.width / dpr;
            const displayHeight = canvas.height / dpr;
            
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, displayWidth, displayHeight);
            saveHistory();
            showToast('画布已清空');
        }
    });
    
    document.getElementById('btn-save').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `liquid-canvas-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('图片已保存');
    });
    
    document.getElementById('btn-open').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const dpr = window.devicePixelRatio || 1;
                    
                    canvas.width = img.width * dpr;
                    canvas.height = img.height * dpr;
                    canvas.style.width = img.width + 'px';
                    canvas.style.height = img.height + 'px';
                    
                    ctx.scale(dpr, dpr);
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    
                    document.getElementById('canvasWidth').value = img.width;
                    document.getElementById('canvasHeight').value = img.height;
                    document.getElementById('widthValue').textContent = img.width + 'px';
                    document.getElementById('heightValue').textContent = img.height + 'px';
                    document.getElementById('canvasInfo').textContent = `${img.width} × ${img.height} px`;
                    
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    
                    history = [];
                    historyStep = -1;
                    saveHistory();
                    showToast('图片已导入');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });
    
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 0.1, 3);
        applyZoom();
    });
    
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.3);
        applyZoom();
    });
}

function applyZoom() {
    canvas.style.transform = `scale(${zoomLevel})`;
    document.getElementById('zoomValue').textContent = Math.round(zoomLevel * 100) + '%';
}

function bindPanelEvents() {
    // 工具切换
    document.querySelectorAll('.sidebar-tool').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sidebar-tool').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            document.getElementById('current-tool-name').textContent = toolNames[currentTool];
            canvas.style.cursor = currentTool === 'picker' ? 'copy' : 'crosshair';
        });
    });
    
    // 颜色选择
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            currentColor = swatch.dataset.color;
            if (currentColor === 'custom') {
                currentColor = document.getElementById('customColor').value;
            }
            updateColorUI();
            updateAmbientGlow(currentColor);
        });
    });
    
    // 自定义颜色
    document.getElementById('customColor').addEventListener('input', (e) => {
        currentColor = e.target.value;
        document.getElementById('colorHex').value = currentColor.toUpperCase();
        document.querySelector('.color-swatch.custom').style.background = currentColor;
        
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        document.querySelector('.color-swatch.custom').classList.add('active');
        updateBrushPreview();
        updateAmbientGlow(currentColor);
    });
    
    // 复制颜色
    document.getElementById('btnCopyColor').addEventListener('click', () => {
        navigator.clipboard.writeText(currentColor.toUpperCase());
        showToast('颜色已复制');
    });
    
    // 笔刷大小
    const brushSizeInput = document.getElementById('brushSize');
    brushSizeInput.addEventListener('input', (e) => {
        currentSize = parseInt(e.target.value);
        document.getElementById('sizeValue').textContent = currentSize + 'px';
        updateBrushPreview();
        updateSliderFill(brushSizeInput, 'sizeFill');
    });
    
    // 不透明度
    const opacityInput = document.getElementById('opacity');
    opacityInput.addEventListener('input', (e) => {
        currentOpacity = parseInt(e.target.value) / 100;
        document.getElementById('opacityValue').textContent = e.target.value + '%';
        updateSliderFill(opacityInput, 'opacityFill');
    });
    
    // 画布宽度
    const widthInput = document.getElementById('canvasWidth');
    widthInput.addEventListener('change', (e) => {
        resizeCanvas(parseInt(e.target.value), null);
        updateSliderFill(widthInput, 'widthFill');
    });
    widthInput.addEventListener('input', (e) => {
        document.getElementById('widthValue').textContent = e.target.value + 'px';
        updateSliderFill(widthInput, 'widthFill');
    });
    
    // 画布高度
    const heightInput = document.getElementById('canvasHeight');
    heightInput.addEventListener('change', (e) => {
        resizeCanvas(null, parseInt(e.target.value));
        updateSliderFill(heightInput, 'heightFill');
    });
    heightInput.addEventListener('input', (e) => {
        document.getElementById('heightValue').textContent = e.target.value + 'px';
        updateSliderFill(heightInput, 'heightFill');
    });
}

function resizeCanvas(newWidth, newHeight) {
    const dpr = window.devicePixelRatio || 1;
    const oldData = canvas.toDataURL();
    
    if (newWidth) {
        canvas.width = newWidth * dpr;
        canvas.style.width = newWidth + 'px';
    }
    if (newHeight) {
        canvas.height = newHeight * dpr;
        canvas.style.height = newHeight + 'px';
    }
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };
    img.src = oldData;
    
    document.getElementById('canvasInfo').textContent = 
        `${Math.round(canvas.width / dpr)} × ${Math.round(canvas.height / dpr)} px`;
    
    saveHistory();
}

// ========================================
// UI 更新
// ========================================
function updateUI() {
    updateColorUI();
    updateBrushPreview();
    updateHistoryUI();
}

function updateColorUI() {
    document.getElementById('colorHex').value = currentColor.toUpperCase();
    document.getElementById('customColor').value = currentColor;
    updateBrushPreview();
}

function updateBrushPreview() {
    const preview = document.getElementById('brushPreview');
    preview.style.width = currentSize + 'px';
    preview.style.height = currentSize + 'px';
    preview.style.background = currentColor;
    preview.style.opacity = currentOpacity;
}

function updateHistoryUI() {
    document.getElementById('history-info').textContent = 
        `历史: ${historyStep + 1}/${history.length}`;
    
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    
    btnUndo.style.opacity = historyStep > 0 ? '1' : '0.3';
    btnRedo.style.opacity = historyStep < history.length - 1 ? '1' : '0.3';
}

function updateStatus(state) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('status-text');
    
    if (state === 'drawing') {
        indicator.classList.add('drawing');
        text.textContent = '绘制中...';
    } else {
        indicator.classList.remove('drawing');
        text.textContent = '就绪';
    }
}

function updateSliderFill(input, fillId) {
    const fill = document.getElementById(fillId);
    const percent = ((input.value - input.min) / (input.max - input.min)) * 100;
    fill.style.width = `calc(${percent}% - 24px)`;
}

function updateSliderFills() {
    updateSliderFill(document.getElementById('brushSize'), 'sizeFill');
    updateSliderFill(document.getElementById('opacity'), 'opacityFill');
    updateSliderFill(document.getElementById('canvasWidth'), 'widthFill');
    updateSliderFill(document.getElementById('canvasHeight'), 'heightFill');
}

// ========================================
// Toast
// ========================================
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

// ========================================
// 键盘快捷键
// ========================================
function handleKeyDown(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 'z':
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
                break;
            case 'y':
                e.preventDefault();
                redo();
                break;
            case 's':
                e.preventDefault();
                document.getElementById('btn-save').click();
                break;
            case 'o':
                e.preventDefault();
                document.getElementById('btn-open').click();
                break;
            case 'n':
                e.preventDefault();
                document.getElementById('btn-new').click();
                break;
        }
    }
    
    const toolMap = {
        '1': 'pen', '2': 'eraser', '3': 'line',
        '4': 'rect', '5': 'circle', '6': 'fill', '7': 'picker'
    };
    if (toolMap[e.key]) {
        const btn = document.querySelector(`[data-tool="${toolMap[e.key]}"]`);
        if (btn) btn.click();
    }
}

// ========================================
// 启动
// ========================================
// ========================================
// AI 绘画功能
// 使用 Pollinations.ai 免费 API
// ========================================

const AI_CONFIG = {
    apiUrl: 'https://image.pollinations.ai/prompt/',
    defaultSize: '1024x1024',
    timeout: 60000
};

let aiHistory = [];
let currentAiMode = 'text2img';
let selectedAiStyle = 'default';
let selectedAiSize = '1024x1024';

// 风格提示词映射
const STYLE_PROMPTS = {
    default: '',
    anime: ', anime style, manga, vibrant colors, detailed',
    watercolor: ', watercolor painting, soft edges, artistic, flowing colors',
    oil: ', oil painting, rich textures, classical art style, museum quality',
    sketch: ', pencil sketch, hand drawn, monochrome, detailed line art',
    cyberpunk: ', cyberpunk style, neon lights, futuristic, high tech, dystopian'
};

// 初始化 AI 功能
function initAI() {
    bindAIEvents();
    updateAIStrengthFill();
}

function bindAIEvents() {
    // 打开/关闭 AI 面板
    document.getElementById('btn-ai-quick').addEventListener('click', toggleAIPanel);
    document.querySelector('.ai-sidebar-tool').addEventListener('click', toggleAIPanel);
    document.getElementById('btnCloseAiPanel').addEventListener('click', closeAIPanel);
    
    // AI 模式切换
    document.querySelectorAll('.ai-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ai-mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentAiMode = tab.dataset.aiMode;
            
            document.querySelectorAll('.ai-mode-content').forEach(c => c.classList.remove('active'));
            document.getElementById(currentAiMode + 'Content').classList.add('active');
            
            if (currentAiMode === 'img2img') {
                updateAICanvasPreview();
            }
        });
    });
    
    // 风格选择
    document.querySelectorAll('.ai-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAiStyle = btn.dataset.style;
        });
    });
    
    // 尺寸选择
    document.querySelectorAll('.ai-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ai-size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedAiSize = btn.dataset.size;
        });
    });
    
    // 生成按钮
    document.getElementById('btnGenerateText').addEventListener('click', generateText2Img);
    document.getElementById('btnGenerateImg').addEventListener('click', generateImg2Img);
    document.getElementById('btnGenerateInpaint').addEventListener('click', generateInpaint);
    
    // 重绘强度滑块
    document.getElementById('aiStrength').addEventListener('input', (e) => {
        document.getElementById('aiStrengthValue').textContent = e.target.value + '%';
        updateAIStrengthFill();
    });
    
    // 清空历史
    document.getElementById('btnClearAiHistory').addEventListener('click', () => {
        aiHistory = [];
        renderAIHistory();
    });
}

function toggleAIPanel() {
    const panel = document.getElementById('aiPanel');
    panel.classList.toggle('open');
    
    if (panel.classList.contains('open') && currentAiMode === 'img2img') {
        updateAICanvasPreview();
    }
}

function closeAIPanel() {
    document.getElementById('aiPanel').classList.remove('open');
}

function updateAIStrengthFill() {
    const input = document.getElementById('aiStrength');
    const fill = document.getElementById('aiStrengthFill');
    const percent = ((input.value - input.min) / (input.max - input.min)) * 100;
    fill.style.width = `calc(${percent}% - 24px)`;
}

// 更新画布预览（图生图模式）
function updateAICanvasPreview() {
    const preview = document.getElementById('aiCanvasPreview');
    const dataUrl = canvas.toDataURL('image/png');
    
    preview.innerHTML = `<img src="${dataUrl}" class="ai-preview-img" alt="当前画布">`;
}

// 显示/隐藏加载
function showAILoading(show) {
    document.getElementById('aiOverlay').classList.toggle('show', show);
}

// 构建提示词
function buildPrompt(basePrompt, style) {
    const stylePrompt = STYLE_PROMPTS[style] || '';
    return encodeURIComponent(basePrompt + stylePrompt + ', high quality, detailed, masterpiece');
}

// 文生图
async function generateText2Img() {
    const prompt = document.getElementById('aiPrompt').value.trim();
    if (!prompt) {
        showToast('请输入画面描述');
        return;
    }
    
    showAILoading(true);
    
    try {
        const fullPrompt = buildPrompt(prompt, selectedAiStyle);
        const [width, height] = selectedAiSize.split('x');
        
        // Pollinations.ai API
        const url = `${AI_CONFIG.apiUrl}${fullPrompt}?width=${width}&height=${height}&nologo=true&seed=${Date.now()}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('生成失败');
        
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);
        
        // 插入到画布
        await insertImageToCanvas(imgUrl);
        
        // 添加到历史
        addToAIHistory(imgUrl, prompt);
        
        showToast('AI 生成完成！');
    } catch (error) {
        console.error(error);
        showToast('生成失败，请重试');
    } finally {
        showAILoading(false);
    }
}

// 图生图
async function generateImg2Img() {
    const prompt = document.getElementById('aiImgPrompt').value.trim() || 'enhance, improve quality, detailed';
    const strength = document.getElementById('aiStrength').value;
    
    showAILoading(true);
    
    try {
        // 获取当前画布内容
        const canvasData = canvas.toDataURL('image/png').split(',')[1];
        
        // 使用 Pollinations 的图生图（通过参考图 URL）
        const fullPrompt = buildPrompt(prompt, selectedAiStyle);
        const [width, height] = selectedAiSize.split('x');
        
        // 注意：Pollinations 不直接支持图生图，这里使用文字描述 + 种子控制
        // 实际项目中可以使用 Stable Diffusion API 或 Replicate API
        const url = `${AI_CONFIG.apiUrl}${fullPrompt}&reference=${encodeURIComponent(canvas.toDataURL())}&width=${width}&height=${height}&nologo=true&seed=${Date.now()}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('生成失败');
        
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);
        
        await insertImageToCanvas(imgUrl);
        addToAIHistory(imgUrl, '图生图: ' + prompt);
        
        showToast('画布优化完成！');
    } catch (error) {
        console.error(error);
        showToast('生成失败，请重试');
    } finally {
        showAILoading(false);
    }
}

// 智能补全
async function generateInpaint() {
    const prompt = document.getElementById('aiInpaintPrompt').value.trim();
    if (!prompt) {
        showToast('请输入补全描述');
        return;
    }
    
    showAILoading(true);
    
    try {
        // 获取选中区域（简化实现：使用整个画布）
        const fullPrompt = buildPrompt(prompt, selectedAiStyle);
        const url = `${AI_CONFIG.apiUrl}${fullPrompt}&width=${canvas.width}&height=${canvas.height}&nologo=true&seed=${Date.now()}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('生成失败');
        
        const blob = await response.blob();
        const imgUrl = URL.createObjectURL(blob);
        
        await insertImageToCanvas(imgUrl);
        addToAIHistory(imgUrl, '补全: ' + prompt);
        
        showToast('智能补全完成！');
    } catch (error) {
        console.error(error);
        showToast('生成失败，请重试');
    } finally {
        showAILoading(false);
    }
}

// 插入图片到画布
function insertImageToCanvas(imgUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = canvas.width / dpr;
            const displayHeight = canvas.height / dpr;
            
            // 计算缩放以适应画布
            const scale = Math.min(
                displayWidth / img.width,
                displayHeight / img.height,
                1
            );
            
            const drawWidth = img.width * scale;
            const drawHeight = img.height * scale;
            const x = (displayWidth - drawWidth) / 2;
            const y = (displayHeight - drawHeight) / 2;
            
            // 保存历史后绘制
            saveHistory();
            ctx.drawImage(img, x, y, drawWidth, drawHeight);
            saveHistory();
            
            resolve();
        };
        img.onerror = reject;
        img.src = imgUrl;
    });
}

// 添加到 AI 历史
function addToAIHistory(imgUrl, prompt) {
    aiHistory.unshift({ imgUrl, prompt, time: Date.now() });
    if (aiHistory.length > 9) aiHistory.pop();
    renderAIHistory();
}

// 渲染 AI 历史
function renderAIHistory() {
    const grid = document.getElementById('aiHistoryGrid');
    grid.innerHTML = aiHistory.map((item, index) => `
        <div class="ai-history-item" onclick="loadAIHistoryImage(${index})">
            <img src="${item.imgUrl}" alt="${item.prompt}">
            <div class="ai-history-overlay">
                <span>点击插入</span>
            </div>
        </div>
    `).join('');
}

// 加载历史图片
window.loadAIHistoryImage = function(index) {
    const item = aiHistory[index];
    if (item) {
        insertImageToCanvas(item.imgUrl);
        showToast('已插入历史图片');
    }
};

// ========================================
// 启动（更新）
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    init();
    initAI();
});
document.addEventListener('DOMContentLoaded', init);