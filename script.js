// =============================================
// CALCULADORA PRO ULTRA - Motor Principal
// =============================================

class Calculator {
    constructor() {
        // Estado principal
        this.currentValue = '0';
        this.previousValue = '';
        this.operator = null;
        this.expression = '';
        this.memory = 0;
        try {
            const savedHistory = JSON.parse(localStorage.getItem('calcHistory') || '[]');
            this.history = Array.isArray(savedHistory) ? savedHistory : [];
        } catch (e) {
            this.history = [];
            localStorage.removeItem('calcHistory');
        }
        this.isNewInput = true;
        this.degRad = true; // true = DEG, false = RAD
        this.bracketCount = 0;
        
        // Programador
        this.progValue = 0;
        this.progBase = 'DEC';
        this.progExpression = '';
        
        // Conversor
        this.converterCategory = 'length';
        
        // Elementos DOM
        this.resultEl = document.getElementById('result');
        this.expressionEl = document.getElementById('expression');
        this.previewEl = document.getElementById('preview');
        this.memoryIndicator = document.getElementById('memoryIndicator');
        this.degRadIndicator = document.getElementById('degRadIndicator');
        this.modeLabel = document.getElementById('modeLabel');
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.renderHistory();
        this.updateDisplay();
        this.setupConverter();
    }
    
    bindEvents() {
        // Usa event delegation para capturar cliques nas teclas
        // Filtra pelas teclas visíveis na aba atual
        const keypad = document.querySelector('.keypad');
        keypad.addEventListener('click', (e) => {
            const target = e.target.closest('.key');
            if (!target) return;

            const value = target.dataset.value;
            const action = target.dataset.action;

            // Só processa se o botão estiver dentro da aba ativa
            const tabContent = target.closest('.tab-content.active');
            if (!tabContent && !target.closest('.memory-row')) return;

            // Se for da memória, ignora aqui (tratado separadamente)
            if (target.closest('.memory-row')) return;

            if (value) {
                this.handleNumber(value);
            } else if (action) {
                this.handleAction(action);
            }
        });
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Theme toggle
        document.getElementById('themeBtn').addEventListener('click', () => this.toggleTheme());
        
        // Painéis
        document.getElementById('historyBtn').addEventListener('click', () => this.openPanel('history'));
        document.getElementById('convertBtn').addEventListener('click', () => this.openPanel('converter'));
        document.getElementById('programmerBtn').addEventListener('click', () => this.openPanel('programmer'));
        
        document.getElementById('closeHistory').addEventListener('click', () => this.closePanel('history'));
        document.getElementById('closeConverter').addEventListener('click', () => this.closePanel('converter'));
        document.getElementById('closeProgrammer').addEventListener('click', () => this.closePanel('programmer'));
        
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
        
        // Converter events
        document.querySelectorAll('.conv-tab').forEach(tab => {
            tab.addEventListener('click', () => this.changeConverterCategory(tab.dataset.category));
        });
        
        document.getElementById('fromValue').addEventListener('input', () => this.convertUnits());
        document.getElementById('fromUnit').addEventListener('change', () => this.convertUnits());
        document.getElementById('toUnit').addEventListener('change', () => this.convertUnits());
        document.getElementById('swapUnits').addEventListener('click', () => this.swapUnits());
        
        // Programmer events
        document.querySelectorAll('.base-btn').forEach(btn => {
            btn.addEventListener('click', () => this.changeBase(btn.dataset.base));
        });
        
        document.querySelectorAll('.prog-key').forEach(btn => {
            btn.addEventListener('click', () => this.handleProgKey(btn));
        });
        
        // Overlay clicks (fechar painéis ao clicar fora)
        document.querySelectorAll('.panel-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const panelId = overlay.id.replace('Overlay', '');
                    this.closePanel(panelId);
                }
            });
        });
        
        // Keyboard support
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    // ===== DISPLAY =====
    updateDisplay() {
        // Formata o número para exibição
        let displayValue = this.formatDisplay(this.currentValue);
        this.resultEl.textContent = displayValue;
        this.expressionEl.textContent = this.expression;
    }
    
    formatDisplay(value) {
        if (value === '' || value === '-') return '0';
        
        // Se está digitando (contém ponto no final ou é parte da expressão)
        if (typeof value === 'string' && (value.endsWith('.') || value.includes('.'))) {
            const parts = value.split('.');
            parts[0] = Number(parts[0]).toLocaleString('pt-BR');
            return parts.join(',');
        }
        
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        
        // Números muito grandes ou pequenos usam notação científica
        if (Math.abs(num) > 999999999999 || (Math.abs(num) < 0.0000001 && num !== 0)) {
            return num.toExponential(6);
        }
        
        // Limita casas decimais
        const str = num.toString();
        if (str.length > 15) {
            return parseFloat(num.toPrecision(12)).toString();
        }
        
        return num.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
    }
    
    previewCalculation() {
        // Preview em tempo real quando o usuário digita operador
    }
    
    // ===== NÚMEROS =====
    handleNumber(value) {
        // Limpa erro se existir
        this.resultEl.classList.remove('error');
        
        if (this.isNewInput) {
            this.currentValue = value === '.' ? '0.' : value;
            this.isNewInput = false;
        } else {
            // Evita múltiplos pontos decimais
            if (value === '.' && this.currentValue.includes('.')) return;
            
            // Se o valor atual é "0" e não é ponto, substitui
            if (this.currentValue === '0' && value !== '.') {
                this.currentValue = value;
            } else {
                this.currentValue += value;
            }
        }
        
        this.updateDisplay();
        this.calculatePreview();
    }
    
    calculatePreview() {
        if (!this.operator || this.previousValue === '') {
            this.previewEl.textContent = '';
            return;
        }
        
        try {
            const prev = parseFloat(this.previousValue);
            const current = parseFloat(this.currentValue);
            let result = this.compute(prev, current, this.operator);
            
            if (!isNaN(result) && isFinite(result)) {
                this.previewEl.textContent = '= ' + result.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
            } else {
                this.previewEl.textContent = '';
            }
        } catch (e) {
            this.previewEl.textContent = '';
        }
    }
    
    // ===== OPERADORES BÁSICOS =====
    handleAction(action) {
        switch (action) {
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
                this.handleOperator(action);
                break;
            case 'calculate':
                this.calculate();
                break;
            case 'clear':
                this.clear();
                break;
            case 'toggle-sign':
                this.toggleSign();
                break;
            case 'percent':
                this.percent();
                break;
            case 'backspace':
                this.backspace();
                break;
            case 'paren-open':
                this.addParenthesis('(');
                break;
            case 'paren-close':
                this.addParenthesis(')');
                break;
            default:
                this.handleScientific(action);
        }
    }
    
    handleOperator(op) {
        if (this.operator && !this.isNewInput) {
            this.calculate(true);
        }
        
        this.previousValue = this.currentValue;
        this.operator = op;
        this.expression = `${this.formatDisplay(this.previousValue)} ${this.getOperatorSymbol(op)}`;
        this.isNewInput = true;
        this.updateDisplay();
        this.calculatePreview();
    }
    
    getOperatorSymbol(op) {
        const symbols = {
            'add': '+',
            'subtract': '−',
            'multiply': '×',
            'divide': '÷'
        };
        return symbols[op] || op;
    }
    
    compute(a, b, op) {
        switch (op) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': 
                if (b === 0) throw new Error('Divisão por zero!');
                return a / b;
            case 'power': return Math.pow(a, b);
            case 'nthroot': return Math.pow(a, 1/b);
            case 'mod': return a % b;
            default: throw new Error('Operação inválida');
        }
    }
    
    calculate(chained = false) {
        if (!this.operator || this.previousValue === '') {
            if (!chained) {
                this.addHistory(`${this.formatDisplay(this.currentValue)}`, this.currentValue);
            }
            return;
        }
        
        try {
            const prev = parseFloat(this.previousValue);
            const current = parseFloat(this.currentValue);
            const result = this.compute(prev, current, this.operator);
            
            if (isNaN(result) || !isFinite(result)) {
                throw new Error('Resultado inválido');
            }
            
            // Constrói a expressão completa
            const fullExpr = `${this.formatDisplay(this.previousValue)} ${this.getOperatorSymbol(this.operator)} ${this.formatDisplay(this.currentValue)}`;
            
            // Arredonda para evitar erros de ponto flutuante
            const rounded = Math.round(result * 1e12) / 1e12;
            
            this.resultEl.classList.remove('animate');
            void this.resultEl.offsetWidth; // Trigger reflow
            this.resultEl.classList.add('animate');
            
            this.currentValue = rounded.toString();
            this.expression = chained ? fullExpr : fullExpr + ' =';
            
            if (!chained) {
                this.addHistory(fullExpr, rounded);
            }
            
            this.previousValue = '';
            this.operator = null;
            this.isNewInput = true;
            this.previewEl.textContent = '';
            this.updateDisplay();
            
        } catch (error) {
            this.resultEl.textContent = 'Erro';
            this.resultEl.classList.add('error');
            setTimeout(() => {
                this.currentValue = '0';
                this.updateDisplay();
                this.resultEl.classList.remove('error');
            }, 1500);
        }
    }
    
    // ===== FUNÇÕES CIENTÍFICAS =====
    handleScientific(action) {
        const value = parseFloat(this.currentValue);
        let result;
        
        try {
            switch (action) {
                // Funções trigonométricas
                case 'sin':
                    result = Math.sin(this.degRadToRadians(value));
                    break;
                case 'cos':
                    result = Math.cos(this.degRadToRadians(value));
                    break;
                case 'tan':
                    result = Math.tan(this.degRadToRadians(value));
                    break;
                case 'asin':
                    result = this.radiansToDeg(Math.asin(value));
                    break;
                case 'acos':
                    result = this.radiansToDeg(Math.acos(value));
                    break;
                case 'atan':
                    result = this.radiansToDeg(Math.atan(value));
                    break;
                
                // Hiperbólicas
                case 'sinh':
                    result = Math.sinh(value);
                    break;
                case 'cosh':
                    result = Math.cosh(value);
                    break;
                case 'tanh':
                    result = Math.tanh(value);
                    break;
                
                // Logaritmos
                case 'log':
                    if (value <= 0) throw new Error('Log inválido');
                    result = Math.log10(value);
                    break;
                case 'ln':
                    if (value <= 0) throw new Error('Ln inválido');
                    result = Math.log(value);
                    break;
                case 'natural-log':
                    if (value <= 0) throw new Error('Ln inválido');
                    result = Math.log(value);
                    break;
                case 'log10':
                    if (value <= 0) throw new Error('Log inválido');
                    result = Math.log10(value);
                    break;
                
                // Potências e raízes
                case 'square':
                case 'pow2':
                    result = Math.pow(value, 2);
                    break;
                case 'cube':
                case 'pow3':
                    result = Math.pow(value, 3);
                    break;
                case 'sqrt':
                case 'sqr-root':
                    if (value < 0) throw new Error('Raiz negativa');
                    result = Math.sqrt(value);
                    break;
                case 'cbrt':
                case 'cbrt-root':
                    result = Math.cbrt(value);
                    break;
                case 'power':
                    this.handlePower();
                    return;
                case 'nthroot':
                    this.handleNthRoot();
                    return;
                
                // Exponenciais
                case 'exp':
                    result = Math.exp(value);
                    break;
                case '10x':
                case '10pow':
                    result = Math.pow(10, value);
                    break;
                
                // Outros
                case 'inv':
                case 'reciprocal':
                    if (value === 0) throw new Error('Divisão por zero');
                    result = 1 / value;
                    break;
                case 'abs':
                case 'abs-val':
                    result = Math.abs(value);
                    break;
                case 'fact':
                case 'factorial':
                    result = this.factorial(value);
                    break;
                case 'floor':
                    result = Math.floor(value);
                    break;
                case 'ceil':
                    result = Math.ceil(value);
                    break;
                case 'mod':
                    this.handleMod();
                    return;
                case 'deg-rad':
                    this.toggleDegRad();
                    return;
                case 'pi':
                    this.currentValue = Math.PI.toString();
                    this.isNewInput = true;
                    this.updateDisplay();
                    return;
                case 'e':
                case 'constant-e':
                    this.currentValue = Math.E.toString();
                    this.isNewInput = true;
                    this.updateDisplay();
                    return;
                
                // Permutações e Combinações
                case 'permutation':
                    this.handlePermutation();
                    return;
                case 'combination':
                    this.handleCombination();
                    return;
                
                // Percent of
                case 'percent-of':
                    this.handlePercentOf();
                    return;
                
                default:
                    return;
            }
            
            // Verifica resultado
            if (isNaN(result) || !isFinite(result)) {
                throw new Error('Resultado inválido');
            }
            
            // Arredonda
            result = Math.round(result * 1e12) / 1e12;
            
            const funcName = action.toUpperCase();
            this.addHistory(`${funcName}(${this.formatDisplay(this.currentValue)})`, result);
            
            this.resultEl.classList.remove('animate');
            void this.resultEl.offsetWidth;
            this.resultEl.classList.add('animate');
            
            this.currentValue = result.toString();
            this.isNewInput = true;
            this.updateDisplay();
            this.previewEl.textContent = `= ${result.toLocaleString('pt-BR', { maximumFractionDigits: 10 })}`;
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    degRadToRadians(degrees) {
        return this.degRad ? degrees * (Math.PI / 180) : degrees;
    }
    
    radiansToDeg(radians) {
        return this.degRad ? radians * (180 / Math.PI) : radians;
    }
    
    factorial(n) {
        if (n < 0) throw new Error('Fatorial de negativo');
        if (n !== Math.floor(n)) throw new Error('Fatorial só de inteiros');
        if (n > 170) throw new Error('Valor muito grande');
        if (n <= 1) return 1;
        
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
    
    // ===== FUNÇÕES AVANÇADAS =====
    handlePower() {
        const base = parseFloat(this.currentValue);
        this.previousValue = this.currentValue;
        this.operator = 'power';
        this.expression = `pow(${this.formatDisplay(this.currentValue)},`;
        this.isNewInput = true;
        this.updateDisplay();
    }
    
    handleNthRoot() {
        const radicand = parseFloat(this.currentValue);
        this.previousValue = this.currentValue;
        this.operator = 'nthroot';
        this.expression = `ⁿ√(${this.formatDisplay(this.currentValue)},`;
        this.isNewInput = true;
        this.updateDisplay();
    }
    
    handleMod() {
        if (this.operator && this.previousValue) {
            const prev = parseFloat(this.previousValue);
            const current = parseFloat(this.currentValue);
            const result = prev % current;
            this.currentValue = result.toString();
            this.expression = `${this.formatDisplay(this.previousValue)} mod ${this.formatDisplay(this.currentValue)} =`;
            this.previousValue = '';
            this.operator = null;
            this.isNewInput = true;
            this.updateDisplay();
        }
    }
    
    handlePermutation() {
        if (this.operator && this.previousValue) {
            const n = parseFloat(this.previousValue);
            const r = parseFloat(this.currentValue);
            if (n < r) throw new Error('n < r');
            const result = this.factorial(n) / this.factorial(n - r);
            this.currentValue = result.toString();
            this.expression = `P(${n}, ${r}) =`;
            this.previousValue = '';
            this.operator = null;
            this.isNewInput = true;
            this.updateDisplay();
        }
    }
    
    handleCombination() {
        if (this.operator && this.previousValue) {
            const n = parseFloat(this.previousValue);
            const r = parseFloat(this.currentValue);
            if (n < r) throw new Error('n < r');
            const result = this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
            this.currentValue = result.toString();
            this.expression = `C(${n}, ${r}) =`;
            this.previousValue = '';
            this.operator = null;
            this.isNewInput = true;
            this.updateDisplay();
        }
    }
    
    handlePercentOf() {
        if (this.operator && this.previousValue) {
            const total = parseFloat(this.previousValue);
            const percent = parseFloat(this.currentValue);
            const result = (total * percent) / 100;
            this.currentValue = result.toString();
            this.expression = `${this.formatDisplay(total)} ${percent}% =`;
            this.previousValue = '';
            this.operator = null;
            this.isNewInput = true;
            this.updateDisplay();
        }
    }
    
    toggleDegRad() {
        this.degRad = !this.degRad;
        this.degRadIndicator.textContent = this.degRad ? 'DEG' : 'RAD';
        this.degRadIndicator.classList.toggle('active', this.degRad);
    }
    
    addParenthesis(paren) {
        if (paren === '(') {
            if (!this.isNewInput && /\d$/.test(this.currentValue)) {
                this.currentValue += '*(';
            } else {
                this.currentValue += '(';
            }
            this.bracketCount++;
        } else {
            this.currentValue += ')';
            this.bracketCount--;
        }
        this.isNewInput = false;
        this.updateDisplay();
    }
    
    // ===== UTILIDADES =====
    clear() {
        this.currentValue = '0';
        this.previousValue = '';
        this.operator = null;
        this.expression = '';
        this.isNewInput = true;
        this.previewEl.textContent = '';
        this.updateDisplay();
    }
    
    backspace() {
        if (this.currentValue.length <= 1 || (this.currentValue.length === 2 && this.currentValue.startsWith('-'))) {
            this.currentValue = '0';
        } else {
            this.currentValue = this.currentValue.slice(0, -1);
        }
        this.isNewInput = false;
        this.updateDisplay();
    }
    
    toggleSign() {
        if (this.currentValue !== '0') {
            this.currentValue = (parseFloat(this.currentValue) * -1).toString();
            this.updateDisplay();
        }
    }
    
    percent() {
        const value = parseFloat(this.currentValue);
        if (this.operator && this.previousValue) {
            const prev = parseFloat(this.previousValue);
            this.currentValue = (prev * value / 100).toString();
        } else {
            this.currentValue = (value / 100).toString();
        }
        this.isNewInput = true;
        this.updateDisplay();
    }
    
    showError(message) {
        this.resultEl.textContent = message;
        this.resultEl.classList.add('error');
        setTimeout(() => {
            this.currentValue = '0';
            this.updateDisplay();
            this.resultEl.classList.remove('error');
        }, 2000);
    }
    
    // ===== MEMÓRIA =====
    handleMemory(action) {
        const current = parseFloat(this.currentValue);
        
        switch (action) {
            case 'mc':
                this.memory = 0;
                this.memoryIndicator.classList.remove('active');
                break;
            case 'mr':
                this.currentValue = this.memory.toString();
                this.isNewInput = false;
                this.updateDisplay();
                break;
            case 'm+':
                this.memory += current;
                this.memoryIndicator.classList.add('active');
                break;
            case 'm-':
                this.memory -= current;
                this.memoryIndicator.classList.add('active');
                break;
            case 'ms':
                this.memory = current;
                this.memoryIndicator.classList.add('active');
                break;
        }
    }
    
    // ===== HISTÓRICO =====
    addHistory(expression, result) {
        const entry = {
            expression,
            result: parseFloat(result).toLocaleString('pt-BR', { maximumFractionDigits: 10 }),
            rawResult: result,
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        
        this.history.unshift(entry);
        if (this.history.length > 50) this.history.pop();
        
        localStorage.setItem('calcHistory', JSON.stringify(this.history));
        this.renderHistory();
    }
    
    renderHistory() {
        const list = document.getElementById('historyList');
        
        if (this.history.length === 0) {
            list.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-clock"></i>
                    <p>Nenhum cálculo ainda</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = this.history.map((entry, i) => `
            <div class="history-item" data-index="${i}">
                <div class="history-expression">${entry.expression}</div>
                <div class="history-result">= ${entry.result}</div>
                <div class="history-time">${entry.time}</div>
            </div>
        `).join('');
        
        // Evento de clique nos itens
        list.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.currentValue = this.history[index].rawResult.toString();
                this.isNewInput = true;
                this.updateDisplay();
                this.closePanel('history');
            });
        });
    }
    
    clearHistory() {
        this.history = [];
        localStorage.removeItem('calcHistory');
        this.renderHistory();
    }
    
    // ===== CONVERSOR DE UNIDADES =====
    setupConverter() {
        const units = {
            length: {
                name: 'Comprimento',
                units: [
                    { name: 'Milímetro (mm)', factor: 0.001 },
                    { name: 'Centímetro (cm)', factor: 0.01 },
                    { name: 'Metro (m)', factor: 1 },
                    { name: 'Quilômetro (km)', factor: 1000 },
                    { name: 'Polegada (in)', factor: 0.0254 },
                    { name: 'Pé (ft)', factor: 0.3048 },
                    { name: 'Jarda (yd)', factor: 0.9144 },
                    { name: 'Milha (mi)', factor: 1609.344 }
                ]
            },
            weight: {
                name: 'Peso',
                units: [
                    { name: 'Miligrama (mg)', factor: 0.000001 },
                    { name: 'Grama (g)', factor: 0.001 },
                    { name: 'Quilograma (kg)', factor: 1 },
                    { name: 'Tonelada (t)', factor: 1000 },
                    { name: 'Onça (oz)', factor: 0.0283495 },
                    { name: 'Libra (lb)', factor: 0.453592 }
                ]
            },
            temperature: {
                name: 'Temperatura',
                units: [
                    { name: 'Celsius (°C)', factor: 'C' },
                    { name: 'Fahrenheit (°F)', factor: 'F' },
                    { name: 'Kelvin (K)', factor: 'K' }
                ]
            },
            area: {
                name: 'Área',
                units: [
                    { name: 'mm²', factor: 0.000001 },
                    { name: 'cm²', factor: 0.0001 },
                    { name: 'm²', factor: 1 },
                    { name: 'km²', factor: 1000000 },
                    { name: 'Hectare (ha)', factor: 10000 },
                    { name: 'Acre', factor: 4046.86 }
                ]
            },
            volume: {
                name: 'Volume',
                units: [
                    { name: 'Mililitro (mL)', factor: 0.001 },
                    { name: 'Litro (L)', factor: 1 },
                    { name: 'Metro cúbico (m³)', factor: 1000 },
                    { name: 'Galão (US)', factor: 3.78541 },
                    { name: 'Pinta (US)', factor: 0.473176 }
                ]
            },
            speed: {
                name: 'Velocidade',
                units: [
                    { name: 'm/s', factor: 1 },
                    { name: 'km/h', factor: 0.277778 },
                    { name: 'mph', factor: 0.44704 },
                    { name: 'Nó (kn)', factor: 0.514444 }
                ]
            },
            data: {
                name: 'Dados',
                units: [
                    { name: 'Byte (B)', factor: 1 },
                    { name: 'Kilobyte (KB)', factor: 1024 },
                    { name: 'Megabyte (MB)', factor: 1048576 },
                    { name: 'Gigabyte (GB)', factor: 1073741824 },
                    { name: 'Terabyte (TB)', factor: 1099511627776 }
                ]
            }
        };
        
        this.converterData = units;
        this.populateConverter('length');
    }
    
    populateConverter(category) {
        const data = this.converterData[category];
        const fromSelect = document.getElementById('fromUnit');
        const toSelect = document.getElementById('toUnit');
        
        fromSelect.innerHTML = data.units.map((u, i) => 
            `<option value="${i}" ${i === 0 ? 'selected' : ''}>${u.name}</option>`
        ).join('');
        
        toSelect.innerHTML = data.units.map((u, i) => 
            `<option value="${i}" ${i === 1 ? 'selected' : ''}>${u.name}</option>`
        ).join('');
        
        this.convertUnits();
    }
    
    changeConverterCategory(category) {
        document.querySelectorAll('.conv-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.conv-tab[data-category="${category}"]`).classList.add('active');
        this.converterCategory = category;
        this.populateConverter(category);
    }
    
    convertUnits() {
        const value = parseFloat(document.getElementById('fromValue').value);
        const fromIndex = parseInt(document.getElementById('fromUnit').value);
        const toIndex = parseInt(document.getElementById('toUnit').value);
        
        if (isNaN(value)) {
            document.getElementById('toValue').value = '';
            return;
        }
        
        let result;
        
        if (this.converterCategory === 'temperature') {
            result = this.convertTemperature(value, fromIndex, toIndex);
        } else {
            const data = this.converterData[this.converterCategory];
            const fromFactor = data.units[fromIndex].factor;
            const toFactor = data.units[toIndex].factor;
            result = (value * fromFactor) / toFactor;
        }
        
        document.getElementById('toValue').value = parseFloat(result.toFixed(10));
    }
    
    convertTemperature(value, from, to) {
        const temps = ['C', 'F', 'K'];
        const fromTemp = temps[from];
        const toTemp = temps[to];
        
        if (fromTemp === toTemp) return value;
        
        // Converte para Celsius primeiro
        let celsius;
        switch (fromTemp) {
            case 'C': celsius = value; break;
            case 'F': celsius = (value - 32) * 5/9; break;
            case 'K': celsius = value - 273.15; break;
        }
        
        // Converte de Celsius para destino
        switch (toTemp) {
            case 'C': return celsius;
            case 'F': return (celsius * 9/5) + 32;
            case 'K': return celsius + 273.15;
        }
    }
    
    swapUnits() {
        const fromSelect = document.getElementById('fromUnit');
        const toSelect = document.getElementById('toUnit');
        const temp = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = temp;
        this.convertUnits();
    }
    
    // ===== MODO PROGRAMADOR =====
    changeBase(base) {
        document.querySelectorAll('.base-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.base-btn[data-base="${base}"]`).classList.add('active');
        this.progBase = base;
        this.updateProgrammerDisplay();
    }
    
    handleProgKey(btn) {
        const action = btn.dataset.action;
        const value = btn.dataset.value;
        const op = btn.dataset.op;
        
        if (value) {
            this.progExpression += value;
        } else if (action === 'prog-clear') {
            this.progExpression = '';
            this.progValue = 0;
        } else if (action === 'prog-back') {
            this.progExpression = this.progExpression.slice(0, -1);
        } else if (action === 'prog-op' && op) {
            this.progExpression += ` ${op} `;
        } else if (action === 'prog-calc') {
            this.calculateProgrammer();
        } else if (action === 'prog-shift-left') {
            this.progValue = this.progValue << 1;
            this.updateProgrammerDisplay();
            return;
        } else if (action === 'prog-shift-right') {
            this.progValue = this.progValue >> 1;
            this.updateProgrammerDisplay();
            return;
        } else if (action === 'prog-mod') {
            this.progValue = this.progValue % parseInt(this.currentValue) || 0;
            this.updateProgrammerDisplay();
            return;
        }
        
        // Atualiza display
        document.getElementById('progExpression').textContent = this.progExpression;
        this.progValue = parseInt(this.getValueFromExpression()) || this.progValue;
        this.updateProgrammerDisplay();
    }
    
    getValueFromExpression() {
        try {
            let expr = this.progExpression.toUpperCase()
                .replace(/AND/g, '&')
                .replace(/OR/g, '|')
                .replace(/XOR/g, '^')
                .replace(/NOT/g, '~');
            
            // Só avalia expressões bit-a-bit válidas
            if (/^\d+\s*[\&\|\^]\s*\d+$/.test(expr)) {
                const parts = expr.split(/\s*[\&\|\^]\s*/);
                const a = parseInt(parts[0]);
                const b = parseInt(parts[1]);
                const operator = expr.match(/[\&\|\^]/)[0];
                
                switch (operator) {
                    case '&': return a & b;
                    case '|': return a | b;
                    case '^': return a ^ b;
                }
            }
            return parseInt(expr) || 0;
        } catch {
            return 0;
        }
    }
    
    calculateProgrammer() {
        this.progValue = parseInt(this.getValueFromExpression()) || 0;
        this.progExpression = '';
        document.getElementById('progExpression').textContent = '=';
        this.updateProgrammerDisplay();
    }
    
    updateProgrammerDisplay() {
        const val = this.progValue;
        
        document.getElementById('binValue').textContent = (val >>> 0).toString(2);
        document.getElementById('octValue').textContent = (val >>> 0).toString(8);
        document.getElementById('decValue').textContent = (val >>> 0).toString(10);
        document.getElementById('hexValue').textContent = (val >>> 0).toString(16).toUpperCase();
        
        document.getElementById('progResult').textContent = (val >>> 0).toString(10);
    }
    
    // ===== PAINÉIS =====
    openPanel(panel) {
        const overlay = document.getElementById(panel + 'Overlay');
        overlay.classList.add('open');
        
        if (panel === 'programmer') {
            this.updateProgrammerDisplay();
        }
    }
    
    closePanel(panel) {
        const overlay = document.getElementById(panel + 'Overlay');
        overlay.classList.remove('open');
    }
    
    // ===== THEME =====
    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('calcTheme', isDark ? 'dark' : 'light');
        document.querySelector('#themeBtn i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    // ===== TABS =====
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        if (tab === 'basic') {
            document.getElementById('basicContent').classList.add('active');
            this.modeLabel.textContent = 'BÁSICA';
        } else if (tab === 'scientific') {
            document.getElementById('scientificContent').classList.add('active');
            this.modeLabel.textContent = 'CIENTÍFICA';
        } else if (tab === 'extra') {
            document.getElementById('extraContent').classList.add('active');
            this.modeLabel.textContent = 'EXTENDIDA';
        }
    }
    
    // ===== TECLADO =====
    handleKeyboard(e) {
        // Não processa se painel estiver aberto
        if (document.querySelector('.panel-overlay.open')) return;
        
        const key = e.key;
        
        if (/\d/.test(key)) {
            this.handleNumber(key);
        } else if (key === '.') {
            this.handleNumber('.');
        } else if (key === '+') {
            this.handleOperator('add');
        } else if (key === '-') {
            this.handleOperator('subtract');
        } else if (key === '*') {
            this.handleOperator('multiply');
        } else if (key === '/') {
            e.preventDefault();
            this.handleOperator('divide');
        } else if (key === 'Enter' || key === '=') {
            e.preventDefault();
            this.calculate();
        } else if (key === 'Escape') {
            this.clear();
        } else if (key === 'Backspace') {
            this.backspace();
        } else if (key === '%') {
            this.percent();
        }
    }
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    const calc = new Calculator();
    
    // Carrega tema salvo
    const savedTheme = localStorage.getItem('calcTheme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.querySelector('#themeBtn i').className = 'fas fa-sun';
    }
    
    // Liga botões de memória
    document.querySelectorAll('.mem-btn').forEach(btn => {
        btn.addEventListener('click', () => calc.handleMemory(btn.dataset.action));
    });
});
