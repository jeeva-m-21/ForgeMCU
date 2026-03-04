import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Plus, X, Cpu, Code2, AlertTriangle, Upload, Download,
  Settings, Terminal, ChevronDown, Loader2, FileJson, Copy,
  Thermometer, Wifi, HardDrive, Clock, MemoryStick, Gauge,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Card, Button, Badge, SectionHeader } from '../components/ui'
import { apiClient, SystemSpecification, ModuleConfig } from '../api/client'

/* ─── Embedded-specific options ─── */

const mcuFamilies: Record<string, { chips: string[]; arch: string; desc: string }> = {
  'STM32': { chips: ['STM32F103', 'STM32F401', 'STM32F407', 'STM32F446', 'STM32H743', 'STM32L476', 'STM32G431'], arch: 'ARM Cortex-M', desc: 'ST Microelectronics — Industrial & automotive' },
  'ESP': { chips: ['ESP32', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6'], arch: 'Xtensa / RISC-V', desc: 'Espressif — WiFi/BLE IoT' },
  'Nordic': { chips: ['nRF52840', 'nRF52832', 'nRF5340'], arch: 'ARM Cortex-M4', desc: 'Nordic Semiconductor — BLE / Thread' },
  'RP': { chips: ['RP2040', 'RP2350'], arch: 'ARM Cortex-M0+/M33', desc: 'Raspberry Pi — Dual-core affordable' },
  'Microchip': { chips: ['ATSAMD21', 'ATSAMD51', 'PIC32MX', 'PIC32MZ'], arch: 'ARM / MIPS', desc: 'Microchip — Legacy & precision' },
  'TI': { chips: ['MSP430FR5994', 'MSP432P401R', 'CC2652R'], arch: 'MSP430 / ARM', desc: 'Texas Instruments — Ultra low power' },
}

const moduleTypes = [
  { value: 'sensor', label: 'Sensor', icon: '📡', desc: 'ADC, I2C, SPI sensor drivers' },
  { value: 'actuator', label: 'Actuator', icon: '⚙️', desc: 'PWM, motor, servo control' },
  { value: 'communication', label: 'Communication', icon: '📶', desc: 'UART, SPI, I2C, CAN, Modbus' },
  { value: 'wireless', label: 'Wireless', icon: '📡', desc: 'WiFi, BLE, LoRa, Zigbee' },
  { value: 'storage', label: 'Storage', icon: '💾', desc: 'EEPROM, Flash, SD card, FRAM' },
  { value: 'display', label: 'Display', icon: '🖥️', desc: 'OLED, LCD, LED matrix' },
  { value: 'power', label: 'Power Mgmt', icon: '🔋', desc: 'Sleep modes, voltage regulation' },
  { value: 'safety', label: 'Safety', icon: '🛡️', desc: 'Watchdog, fault detection, CRC' },
  { value: 'timer', label: 'Timer/PWM', icon: '⏱️', desc: 'Hardware timers, interrupts' },
  { value: 'input', label: 'Input', icon: '🔘', desc: 'GPIO, buttons, encoders' },
  { value: 'protocol', label: 'Protocol', icon: '📋', desc: 'Modbus, CANopen, MQTT' },
  { value: 'custom', label: 'Custom', icon: '🧩', desc: 'User-defined module' },
]

const peripheralOptions = [
  'GPIO', 'UART', 'SPI', 'I2C', 'CAN', 'USB', 'ADC', 'DAC',
  'PWM', 'Timer', 'DMA', 'RTC', 'Watchdog', 'Ethernet', 'SDIO',
]

const interfaceOptions = ['I2C', 'SPI', 'UART', 'CAN', 'USB', 'OneWire', 'Modbus', 'GPIO']

const optimizationGoals = [
  { value: 'balanced', label: 'Balanced', icon: Gauge },
  { value: 'performance', label: 'Speed', icon: Zap },
  { value: 'memory', label: 'Memory', icon: MemoryStick },
  { value: 'power', label: 'Low Power', icon: Clock },
]

/* ─── Example embedded JSON templates ─── */

const exampleTemplates: Record<string, any> = {
  'Temperature Monitor': {
    project_name: 'temperature-monitor',
    description: 'Industrial temperature monitoring system with I2C sensor, OLED display, UART logging, and over-temperature alarm output. Reads DS18B20 and BME280 sensors at configurable intervals.',
    mcu: 'STM32F401',
    modules: [
      { name: 'temp_sensor', type: 'sensor', description: 'DS18B20 1-Wire temperature sensor driver with CRC validation and multi-drop support', parameters: { interface: 'OneWire', pin: 'PA0', sampling_rate_hz: 1 } },
      { name: 'env_sensor', type: 'sensor', description: 'BME280 I2C environmental sensor (temperature, humidity, pressure)', parameters: { interface: 'I2C', address: '0x76', sampling_rate_hz: 2 } },
      { name: 'oled_display', type: 'display', description: 'SSD1306 128x64 OLED display via I2C showing live readings', parameters: { interface: 'I2C', address: '0x3C', resolution: '128x64' } },
      { name: 'uart_logger', type: 'communication', description: 'UART debug output at 115200 baud for data logging', parameters: { interface: 'UART', baud_rate: 115200, tx_pin: 'PA2' } },
      { name: 'alarm_output', type: 'actuator', description: 'GPIO-driven buzzer and LED alarm for over-temperature condition', parameters: { interface: 'GPIO', alarm_pin: 'PB0', led_pin: 'PB1' } },
    ],
    requirements: [
      'Read temperature sensors every 1 second',
      'Display current temp, humidity, pressure on OLED',
      'Trigger alarm when temperature exceeds 85°C',
      'Log all readings to UART at 115200 baud',
      'Implement configurable alarm thresholds stored in EEPROM',
      'Support low-power sleep between readings if battery-operated',
    ],
    constraints: {
      flash_kb: 256,
      ram_kb: 64,
      clock_mhz: 84,
      supply_voltage: '3.3V',
      operating_temp: '-20°C to +85°C',
    },
    safety_critical: false,
    optimization_goal: 'power',
  },
  'Motor Controller': {
    project_name: 'bldc-motor-controller',
    description: 'Closed-loop BLDC motor controller with FOC (Field-Oriented Control), quadrature encoder feedback, CAN bus telemetry, and safety shutdown on overcurrent/overtemperature.',
    mcu: 'STM32G431',
    modules: [
      { name: 'foc_controller', type: 'actuator', description: 'Field-oriented control for 3-phase BLDC motor with space vector PWM', parameters: { interface: 'PWM', channels: 3, frequency_khz: 20, dead_time_ns: 200 } },
      { name: 'encoder', type: 'sensor', description: 'Quadrature encoder interface (TIM3) for rotor position and RPM calculation', parameters: { interface: 'Timer', resolution_cpr: 4096, max_rpm: 10000 } },
      { name: 'current_sense', type: 'sensor', description: 'Inline shunt current sensing on 3 phases via ADC with DMA', parameters: { interface: 'ADC', channels: 3, sampling_rate_khz: 40 } },
      { name: 'can_telemetry', type: 'communication', description: 'CAN 2.0B interface for motor status broadcast and command reception', parameters: { interface: 'CAN', baud_rate: 500000, node_id: 1 } },
      { name: 'safety_monitor', type: 'safety', description: 'Overcurrent, overtemperature, and stall detection with hardware fault shutdown', parameters: { interface: 'GPIO', overcurrent_threshold_a: 30, overtemp_threshold_c: 100 } },
      { name: 'pid_regulator', type: 'custom', description: 'Cascaded PID loops for speed and current regulation with anti-windup', parameters: { kp: 0.5, ki: 0.01, kd: 0.001, output_limit: 95 } },
    ],
    requirements: [
      'Implement FOC algorithm with space vector PWM at 20kHz',
      'Read encoder position via hardware timer capture',
      'Sample phase currents at 40kHz with DMA transfer',
      'Broadcast motor RPM, current, temperature over CAN every 10ms',
      'Implement cascaded PID with anti-windup for speed control',
      'Hardware fault shutdown within 50μs of overcurrent detection',
      'Watchdog timer with 10ms timeout for safety',
    ],
    constraints: {
      flash_kb: 256,
      ram_kb: 32,
      clock_mhz: 170,
      supply_voltage: '3.3V / 48V motor',
      pwm_frequency_khz: 20,
      control_loop_us: 50,
    },
    safety_critical: true,
    optimization_goal: 'performance',
  },
  'IoT Weather Station': {
    project_name: 'iot-weather-station',
    description: 'Solar-powered IoT weather station with BLE and WiFi connectivity, multi-sensor data acquisition, MQTT publishing, and OTA firmware updates.',
    mcu: 'ESP32-S3',
    modules: [
      { name: 'weather_sensors', type: 'sensor', description: 'BME280 (temp/humidity/pressure) + BH1750 (light) + wind speed anemometer', parameters: { interface: 'I2C', sensors: ['BME280', 'BH1750'], anemometer_pin: 'GPIO34' } },
      { name: 'wifi_manager', type: 'wireless', description: 'WiFi STA mode with auto-reconnect, AP mode for provisioning', parameters: { interface: 'WiFi', mode: 'STA+AP', dhcp: true } },
      { name: 'mqtt_client', type: 'protocol', description: 'MQTT v3.1.1 client publishing sensor data to broker with QoS 1', parameters: { interface: 'WiFi', broker_port: 1883, qos: 1, interval_s: 60 } },
      { name: 'ble_beacon', type: 'wireless', description: 'BLE advertisement broadcasting current weather as iBeacon-compatible payload', parameters: { interface: 'BLE', adv_interval_ms: 1000 } },
      { name: 'power_manager', type: 'power', description: 'Solar charge monitoring, deep sleep scheduling, battery voltage sensing', parameters: { interface: 'ADC', battery_pin: 'GPIO35', solar_pin: 'GPIO36', sleep_interval_min: 5 } },
      { name: 'sd_logger', type: 'storage', description: 'MicroSD card logging in CSV format with hourly file rotation', parameters: { interface: 'SPI', cs_pin: 'GPIO5', format: 'CSV' } },
      { name: 'ota_updater', type: 'custom', description: 'OTA firmware update via HTTPS with rollback support', parameters: { interface: 'WiFi', server_url: 'https://fw.example.com', partition: 'ota_0' } },
    ],
    requirements: [
      'Read all sensors every 60 seconds',
      'Publish data via MQTT with JSON payload',
      'Advertise latest reading via BLE beacon',
      'Log all data to SD card in CSV format',
      'Enter deep sleep between readings to conserve battery',
      'Monitor battery voltage and disable WiFi below 3.4V',
      'Support OTA firmware updates with HTTPS verification',
      'Fallback to AP mode if WiFi credentials are invalid',
    ],
    constraints: {
      flash_kb: 4096,
      ram_kb: 512,
      clock_mhz: 240,
      supply_voltage: '3.3V (LiPo + solar)',
      average_current_ma: 5,
      operating_temp: '-30°C to +60°C',
    },
    safety_critical: false,
    optimization_goal: 'power',
  },
}

const animCodeLines = [
  '$ forgemcu generate --target STM32F4',
  'Initializing LangGraph pipeline...',
  '├─ Architecture Agent: analyzing spec',
  '│  └─ Generating system architecture',
  '│  └─ HAL abstraction layer mapped',
  '│  └─ Interrupt priority table built',
  '├─ Code Agent: writing firmware',
  '│  └─ HAL_Init() + SystemClock_Config()',
  '│  └─ Peripheral drivers generated',
  '│  └─ Application state machine ready',
  '├─ Test Agent: creating test suite',
  '│  └─ Unit tests: 24 cases',
  '│  └─ Hardware mock stubs created',
  '├─ Quality Agent: static analysis',
  '│  └─ MISRA-C:2012 compliance: 98%',
  '│  └─ Cyclomatic complexity: OK',
  '└─ Build Agent: compiling',
  '   └─ arm-none-eabi-gcc -O2 -mcpu=cortex-m4',
  '   └─ .bin + .hex + .elf generated',
  '',
  '✓ Pipeline complete — artifacts ready',
]

export default function GeneratePage() {
  const navigate = useNavigate()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingLine, setGeneratingLine] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showJsonPreview, setShowJsonPreview] = useState(false)
  const [activeFamily, setActiveFamily] = useState<string>('STM32')

  const [spec, setSpec] = useState<SystemSpecification>({
    project_name: '',
    description: '',
    mcu: 'STM32F401',
    modules: [],
    constraints: {},
    requirements: [],
    safety_critical: false,
    optimization_goal: 'balanced',
    model_provider: 'mock',
    model_name: '',
    api_key: '',
    architecture_only: false,
  })

  const [requirementsText, setRequirementsText] = useState('')
  const [constraintsText, setConstraintsText] = useState('')

  // Typing animation for overlay
  useEffect(() => {
    if (!isGenerating) { setGeneratingLine(0); return }
    const interval = setInterval(() => {
      setGeneratingLine(prev => {
        if (prev >= animCodeLines.length - 1) return prev
        return prev + 1
      })
    }, 700)
    return () => clearInterval(interval)
  }, [isGenerating])

  const updateSpec = (patch: Partial<SystemSpecification>) => setSpec(prev => ({ ...prev, ...patch }))

  const addModule = () => {
    updateSpec({ modules: [...spec.modules, { name: '', type: 'sensor', description: '', requirements: [], parameters: {} }] })
  }

  const updateModule = (idx: number, patch: Partial<ModuleConfig>) => {
    const modules = [...spec.modules]
    modules[idx] = { ...modules[idx], ...patch }
    updateSpec({ modules })
  }

  const removeModule = (idx: number) => {
    updateSpec({ modules: spec.modules.filter((_, i) => i !== idx) })
  }

  /* ─── JSON Import / Export ─── */

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        applyJsonSpec(json)
        toast.success(`Imported "${file.name}"`)
      } catch (err) {
        toast.error('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const applyJsonSpec = (json: any) => {
    const newSpec: Partial<SystemSpecification> = {}
    if (json.project_name) newSpec.project_name = json.project_name
    if (json.description) newSpec.description = json.description
    if (json.mcu) newSpec.mcu = json.mcu
    if (json.modules && Array.isArray(json.modules)) {
      newSpec.modules = json.modules.map((m: any) => ({
        name: m.name || m.id || '',
        type: m.type || 'custom',
        description: m.description || m.responsibility || '',
        parameters: m.parameters || {},
        requirements: m.requirements || [],
      }))
    }
    if (json.safety_critical !== undefined) newSpec.safety_critical = json.safety_critical
    if (json.optimization_goal) newSpec.optimization_goal = json.optimization_goal
    if (json.architecture_only !== undefined) newSpec.architecture_only = json.architecture_only
    setSpec(prev => ({ ...prev, ...newSpec }))

    if (json.requirements && Array.isArray(json.requirements)) {
      setRequirementsText(json.requirements.join('\n'))
    }
    if (json.constraints && typeof json.constraints === 'object') {
      setConstraintsText(
        Object.entries(json.constraints).map(([k, v]) => `${k}: ${v}`).join('\n')
      )
    }
    // Auto-select MCU family
    for (const [family, data] of Object.entries(mcuFamilies)) {
      if (data.chips.some(c => json.mcu?.includes(c) || c.includes(json.mcu))) {
        setActiveFamily(family)
        break
      }
    }
  }

  const loadTemplate = (name: string) => {
    const tpl = exampleTemplates[name]
    if (!tpl) return
    applyJsonSpec(tpl)
    toast.success(`Loaded "${name}" template`)
  }

  const exportJson = () => {
    const exportSpec = {
      project_name: spec.project_name,
      description: spec.description,
      mcu: spec.mcu,
      modules: spec.modules.map(m => ({
        name: m.name,
        type: m.type,
        description: m.description,
        ...(m.parameters && Object.keys(m.parameters).length > 0 ? { parameters: m.parameters } : {}),
      })),
      requirements: requirementsText.split('\n').map(r => r.trim()).filter(Boolean),
      constraints: constraintsText.trim()
        ? Object.fromEntries(constraintsText.split('\n').map(l => l.split(':').map(s => s.trim())).filter(p => p.length === 2))
        : {},
      safety_critical: spec.safety_critical,
      optimization_goal: spec.optimization_goal,
    }
    const blob = new Blob([JSON.stringify(exportSpec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${spec.project_name || 'firmware-spec'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported specification JSON')
  }

  const copyJson = () => {
    const exportSpec = {
      project_name: spec.project_name,
      description: spec.description,
      mcu: spec.mcu,
      modules: spec.modules,
      requirements: requirementsText.split('\n').map(r => r.trim()).filter(Boolean),
      constraints: constraintsText.trim()
        ? Object.fromEntries(constraintsText.split('\n').map(l => l.split(':').map(s => s.trim())).filter(p => p.length === 2))
        : {},
      safety_critical: spec.safety_critical,
      optimization_goal: spec.optimization_goal,
    }
    navigator.clipboard.writeText(JSON.stringify(exportSpec, null, 2))
    toast.success('JSON copied to clipboard')
  }

  const handleGenerate = async () => {
    if (!spec.project_name.trim()) return toast.error('Project name is required')
    if (!spec.mcu) return toast.error('Select a target MCU')
    if (spec.modules.length === 0) return toast.error('Add at least one module')
    const emptyMod = spec.modules.find(m => !m.name.trim())
    if (emptyMod) return toast.error('All modules need a name')

    setIsGenerating(true)
    try {
      const finalSpec: SystemSpecification = {
        ...spec,
        requirements: requirementsText.split('\n').map(r => r.trim()).filter(Boolean),
        constraints: constraintsText.trim()
          ? Object.fromEntries(constraintsText.split('\n').map(l => l.split(':').map(s => s.trim())).filter(p => p.length === 2))
          : {},
      }

      const { run_id } = await apiClient.generate(finalSpec)
      const savedRuns = JSON.parse(localStorage.getItem('generated_runs') || '[]')
      savedRuns.push(run_id)
      localStorage.setItem('generated_runs', JSON.stringify(savedRuns))

      let attempts = 0
      const poll = setInterval(async () => {
        try {
          const status = await apiClient.getRunStatus(run_id)
          if (status.status === 'completed' || status.status === 'failed' || attempts > 180) {
            clearInterval(poll)
            setIsGenerating(false)
            if (status.status === 'completed') {
              toast.success('Firmware generated successfully')
              navigate(`/build/${run_id}`)
            } else if (status.status === 'failed') {
              toast.error(status.message || 'Generation failed')
            }
          }
          attempts++
        } catch {
          attempts++
        }
      }, 2000)
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
      setIsGenerating(false)
    }
  }

  const inputCls = 'w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#444] focus:border-[#444] focus:outline-none transition-colors font-mono'
  const selectCls = 'bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-[13px] text-white focus:border-[#444] focus:outline-none transition-colors appearance-none cursor-pointer'
  const chipBtnCls = (active: boolean) => `px-3 py-1.5 rounded-lg text-[12px] border transition-all duration-150 ${active ? 'bg-white text-black border-white font-medium' : 'bg-[#111] text-[#666] border-[#222] hover:border-[#333] hover:text-[#888]'}`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJson} />

      {/* Generation Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-[600px] border border-[#222] rounded-2xl bg-[#0a0a0a] overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1a1a1a]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#333]" />
                </div>
                <span className="text-[11px] text-[#444] font-mono ml-2">forgemcu — {spec.project_name} — {spec.mcu}</span>
              </div>
              <div className="p-5 font-mono text-[12px] leading-[2] min-h-[420px]">
                {animCodeLines.slice(0, generatingLine + 1).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`${line.startsWith('✓') ? 'text-white font-semibold' : line.startsWith('$') ? 'text-white' : 'text-[#666]'}`}
                  >
                    {line || '\u00A0'}
                    {i === generatingLine && i < animCodeLines.length - 1 && (
                      <span className="typing-cursor" />
                    )}
                  </motion.div>
                ))}
                {generatingLine < animCodeLines.length - 1 && (
                  <div className="flex items-center gap-2 mt-4 text-[#555]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Pipeline running...</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header + Import/Export */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight">Generate Firmware</h1>
          <p className="text-[13px] text-[#666] mt-1">Configure embedded system specification or import from JSON</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> Import JSON
          </Button>
          <Button variant="ghost" size="sm" onClick={exportJson}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowJsonPreview(!showJsonPreview)}>
            <FileJson className="w-3.5 h-3.5" /> {showJsonPreview ? 'Hide' : 'Preview'}
          </Button>
        </div>
      </div>

      {/* Example Templates */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-medium text-[#555] uppercase tracking-wider">Quick Start Templates</span>
          <div className="flex-1 h-px bg-[#1a1a1a]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(exampleTemplates).map(([name, tpl]) => (
            <button
              key={name}
              onClick={() => loadTemplate(name)}
              className="text-left p-3 rounded-lg border border-[#1a1a1a] bg-[#111]/50 hover:border-[#333] hover:bg-[#111] transition-all group"
            >
              <span className="text-[13px] font-medium text-white group-hover:text-white">{name}</span>
              <p className="text-[11px] text-[#555] mt-0.5 line-clamp-2">{(tpl as any).description?.slice(0, 80)}…</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="default" className="text-[10px]">{(tpl as any).mcu}</Badge>
                <Badge variant="default" className="text-[10px]">{(tpl as any).modules?.length} modules</Badge>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* JSON Preview Panel */}
      <AnimatePresence>
        {showJsonPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <FileJson className="w-3.5 h-3.5 text-[#555]" />
                  <span className="text-[12px] text-[#888]">specification.json</span>
                </div>
                <Button variant="ghost" size="sm" onClick={copyJson}>
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </div>
              <pre className="p-4 text-[11px] font-mono text-[#888] leading-relaxed max-h-[200px] overflow-auto bg-[#0a0a0a]">
                {JSON.stringify({
                  project_name: spec.project_name, description: spec.description, mcu: spec.mcu,
                  modules: spec.modules, requirements: requirementsText.split('\n').filter(Boolean),
                  constraints: constraintsText.trim() ? Object.fromEntries(constraintsText.split('\n').map(l => l.split(':').map(s => s.trim())).filter(p => p.length === 2)) : {},
                  safety_critical: spec.safety_critical, optimization_goal: spec.optimization_goal,
                }, null, 2)}
              </pre>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Config */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-[#555]" />
          <span className="text-[13px] font-medium text-[#888]">Project Configuration</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] text-[#555] mb-1.5">Project Name</label>
            <input
              className={inputCls}
              placeholder="my-firmware-project"
              value={spec.project_name}
              onChange={e => updateSpec({ project_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[12px] text-[#555] mb-1.5">AI Provider</label>
            <div className="flex gap-2">
              {['mock', 'gemini'].map(p => (
                <button
                  key={p}
                  onClick={() => updateSpec({ model_provider: p })}
                  className={chipBtnCls(spec.model_provider === p) + ' capitalize flex-1'}
                >
                  {p === 'gemini' ? '✦ Gemini' : '⊘ Mock'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[12px] text-[#555] mb-1.5">System Description</label>
          <textarea
            className={`${inputCls} min-h-[70px] resize-none`}
            placeholder="Describe the embedded system purpose, target environment, and key behaviors…"
            rows={3}
            value={spec.description || ''}
            onChange={e => updateSpec({ description: e.target.value })}
          />
        </div>
      </Card>

      {/* MCU Selection — Family-based */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-[#555]" />
          <span className="text-[13px] font-medium text-[#888]">Target MCU</span>
          {spec.mcu && <Badge variant="success" className="text-[10px] font-mono">{spec.mcu}</Badge>}
        </div>

        {/* Family tabs */}
        <div className="flex gap-2 flex-wrap">
          {Object.keys(mcuFamilies).map(fam => (
            <button
              key={fam}
              onClick={() => setActiveFamily(fam)}
              className={chipBtnCls(activeFamily === fam)}
            >
              {fam}
            </button>
          ))}
        </div>

        {/* Family info + chip selector */}
        {activeFamily && mcuFamilies[activeFamily] && (
          <div className="p-3 rounded-lg border border-[#1a1a1a] bg-[#111]/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#888]">{mcuFamilies[activeFamily].desc}</span>
              <span className="text-[11px] text-[#555] font-mono">{mcuFamilies[activeFamily].arch}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {mcuFamilies[activeFamily].chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => updateSpec({ mcu: chip })}
                  className={chipBtnCls(spec.mcu === chip) + ' font-mono'}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optimization + Hardware constraints row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] text-[#555] mb-1.5">Optimization Goal</label>
            <div className="flex gap-2">
              {optimizationGoals.map(g => (
                <button
                  key={g.value}
                  onClick={() => updateSpec({ optimization_goal: g.value })}
                  className={chipBtnCls(spec.optimization_goal === g.value) + ' flex items-center gap-1'}
                >
                  <g.icon className="w-3 h-3" /> {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Modules — Enhanced */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#555]" />
            <span className="text-[13px] font-medium text-[#888]">Hardware Modules</span>
            <Badge variant="default">{spec.modules.length}</Badge>
          </div>
          <Button variant="secondary" size="sm" onClick={addModule}>
            <Plus className="w-3.5 h-3.5" /> Add Module
          </Button>
        </div>

        {spec.modules.length === 0 ? (
          <div className="py-8 text-center">
            <HardDrive className="w-8 h-8 text-[#333] mx-auto mb-2" />
            <p className="text-[13px] text-[#555]">No modules defined</p>
            <p className="text-[11px] text-[#444] mt-1">Add sensor, actuator, communication, or peripheral modules</p>
          </div>
        ) : (
          <div className="space-y-3">
            {spec.modules.map((mod, idx) => {
              const modMeta = moduleTypes.find(t => t.value === mod.type)
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-[#1a1a1a] rounded-lg p-3.5 bg-[#111]/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0a0a0a] border border-[#222] flex items-center justify-center text-sm flex-shrink-0">
                      {modMeta?.icon || '🧩'}
                    </div>
                    <div className="flex-1 space-y-3">
                      {/* Row 1: Name + Type */}
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          className={inputCls}
                          placeholder="module_name"
                          value={mod.name}
                          onChange={e => updateModule(idx, { name: e.target.value })}
                        />
                        <div className="relative">
                          <select
                            className={`${selectCls} w-full pr-8`}
                            value={mod.type}
                            onChange={e => updateModule(idx, { type: e.target.value })}
                          >
                            {moduleTypes.map(t => (
                              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-[#444] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative">
                          <select
                            className={`${selectCls} w-full pr-8`}
                            value={(mod.parameters as any)?.interface || ''}
                            onChange={e => updateModule(idx, { parameters: { ...mod.parameters, interface: e.target.value } })}
                          >
                            <option value="">Interface…</option>
                            {interfaceOptions.map(i => <option key={i} value={i}>{i}</option>)}
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-[#444] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      {/* Row 2: Description */}
                      <input
                        className={inputCls}
                        placeholder="Module description — e.g., Read DS18B20 temperature sensor via OneWire with CRC validation"
                        value={mod.description || ''}
                        onChange={e => updateModule(idx, { description: e.target.value })}
                      />
                    </div>
                    <button
                      onClick={() => removeModule(idx)}
                      className="p-1.5 rounded-md hover:bg-[#222] text-[#444] hover:text-[#888] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Requirements & Constraints */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#555]" />
            <span className="text-[13px] font-medium text-[#888]">Functional Requirements</span>
          </div>
          <p className="text-[11px] text-[#444]">Timing, behavior, interfaces — one per line</p>
          <textarea
            className={`${inputCls} min-h-[130px] resize-none`}
            placeholder={"Read sensor every 100ms\nTransmit telemetry via UART at 115200\nImplement watchdog with 500ms timeout\nEnter sleep mode when idle > 5s"}
            value={requirementsText}
            onChange={e => setRequirementsText(e.target.value)}
          />
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#555]" />
            <span className="text-[13px] font-medium text-[#888]">Hardware Constraints</span>
          </div>
          <p className="text-[11px] text-[#444]">Memory, clock, voltage — key: value per line</p>
          <textarea
            className={`${inputCls} min-h-[130px] resize-none`}
            placeholder={"flash_kb: 256\nram_kb: 64\nclock_mhz: 168\nsupply_voltage: 3.3V\noperating_temp: -40°C to +85°C"}
            value={constraintsText}
            onChange={e => setConstraintsText(e.target.value)}
          />
        </Card>
      </div>

      {/* Toggles + Generate */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={spec.safety_critical}
                onChange={e => updateSpec({ safety_critical: e.target.checked })}
              />
              <div className="w-9 h-[18px] bg-[#222] peer-checked:bg-white rounded-full relative transition-colors">
                <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-[#666] peer-checked:bg-black rounded-full transition-all peer-checked:translate-x-[18px]" />
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[#888] group-hover:text-[#ccc] transition-colors">
                <AlertTriangle className="w-3 h-3" /> Safety Critical (MISRA-C)
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={spec.architecture_only}
                onChange={e => updateSpec({ architecture_only: e.target.checked })}
              />
              <div className="w-9 h-[18px] bg-[#222] peer-checked:bg-white rounded-full relative transition-colors">
                <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-[#666] peer-checked:bg-black rounded-full transition-all peer-checked:translate-x-[18px]" />
              </div>
              <span className="text-[12px] text-[#888] group-hover:text-[#ccc] transition-colors">Architecture Only</span>
            </label>
          </div>
          <Button variant="primary" size="lg" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Zap className="w-4 h-4" /> Generate Firmware</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
