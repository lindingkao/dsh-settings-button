/**
 * dsh-settings-button — Client 半（Web）
 *
 * 实测结构：侧栏脚部的 `sidebar.settings` 座位渲染成一行
 * `div.<hash>_triggerRow`，其中只有账号启动器（头像 + 名字，按钮
 * `aria-label="账号菜单"`），设置入口在账号菜单内部。
 *
 * 本插件在该行尾注入一个常驻齿轮按钮。点击时优先派发宿主自己的
 * `settings.open` 快捷键命令（经 ctx.shortcuts.registry.invoke 直达 shell 的
 * actions.open()，不经过任何 DOM 交互）；命令不可用时才回退到短暂打开账号
 * 菜单并点其中的设置项（菜单在注入的 suppress 类下不可见，因此不闪）。宿主
 * 若已经自带设置触发按钮（较新版本），则只把该按钮排到行尾，不再注入，避免
 * 出现两个入口。
 *
 * 约束：本文件是宿主直接装载的零构建产物（window.__ModuleLoader__.load），
 * 不 require 任何 Harness Client 包，只经由 ctx.slots / ctx.locale /
 * ctx.shortcuts 协作。
 */
window.__ModuleLoader__.load({
  id: 'dsh-settings-button',
  factory() {
    /** 注入按钮的类名（只依赖本插件自己的前缀）。 */
    const BUTTON_CLASS = 'dsh-sb-button'
    /** 按钮内图标容器的类名。 */
    const ICON_CLASS = 'dsh-sb-icon'
    /** 按钮内文案的类名。 */
    const LABEL_CLASS = 'dsh-sb-label'
    /** 样式标签的 data 标记，便于幂等注入与卸载清理。 */
    const STYLE_ID = 'dsh-settings-button'
    /** 点击期间临时抑制账号菜单可见性的 body 类。 */
    const SUPPRESS_CLASS = 'dsh-sb-suppress-menu'
    /** DOM 变更合并窗口（毫秒）：折叠动画会连续重渲染脚部。 */
    const SETTLE_MS = 120
    /** 打开账号菜单后等待其渲染的时间（毫秒）。 */
    const OPEN_SETTLE_MS = 160
    /** 派发 settings.open 命令后每次轮询的间隔（毫秒）。 */
    const COMMAND_SETTLE_MS = 40
    /** 派发命令后的轮询次数：40ms × 6 = 240ms，足够面板挂载。 */
    const COMMAND_POLLS = 6
    /** 宿主快捷键层判定「当前弹窗」用的选择器，与 dsh-client-shortcuts 一致。 */
    const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="dialog"][data-shortcut-modal]'
    /** 窄栏（56px 轨道）阈值：行宽小于该值时藏起齿轮，避免挤压头像。 */
    const RAIL_MAX_WIDTH = 60
    /** 宿主已自带设置按钮时，让它排在行尾的 order。 */
    const HOST_TRIGGER_ORDER = '1'
    /** 文案取不到时的回退词表。 */
    const FALLBACK_LABELS = Object.freeze(['设置', '設定', 'Settings', 'Einstellungen', 'Paramètres', 'Impostazioni', 'Настройки', 'Configuración'])

    /** 宿主自带的设置齿轮（ui-primitives 的 IconSettingsOutlineMedium，16×16，currentColor 着色）。 */
    const GEAR_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke-width="1.3"><path d="M8 9.75012C8.9665 9.75012 9.75 8.96662 9.75 8.00012C9.75 7.03362 8.9665 6.25012 8 6.25012C7.0335 6.25012 6.25 7.03362 6.25 8.00012C6.25 8.96662 7.0335 9.75012 8 9.75012Z" stroke="currentColor"></path><path d="M13.0107 7.79377C12.9505 7.89401 12.9205 7.94413 12.9205 7.99951C12.9205 8.0549 12.9505 8.10502 13.0106 8.20528L13.9849 9.83006C14.045 9.93029 14.0751 9.9804 14.0751 10.0358C14.0751 10.0911 14.045 10.1413 13.9849 10.2415L13.0037 11.8777C12.9468 11.9726 12.9184 12.0201 12.8725 12.0461C12.8267 12.072 12.7713 12.072 12.6607 12.072H10.6704C10.5598 12.072 10.5045 12.072 10.4586 12.098C10.4128 12.1239 10.3843 12.1714 10.3274 12.2662L9.33825 13.9142C9.28133 14.009 9.25287 14.0564 9.20703 14.0823C9.16118 14.1083 9.10588 14.1083 8.99529 14.1083H7.00486C6.89426 14.1083 6.83896 14.1083 6.79312 14.0823C6.74727 14.0564 6.71881 14.009 6.6619 13.9142L5.67273 12.2662C5.61581 12.1714 5.58735 12.1239 5.54151 12.098C5.49566 12.072 5.44036 12.072 5.32977 12.072H3.33945C3.2288 12.072 3.17347 12.072 3.12761 12.0461C3.08176 12.0201 3.0533 11.9726 2.9964 11.8777L2.0152 10.2415C1.9551 10.1413 1.92505 10.0911 1.92505 10.0358C1.92505 9.9804 1.9551 9.93029 2.0152 9.83006L2.98951 8.20528C3.04963 8.10502 3.07969 8.0549 3.07969 7.99951C3.07968 7.94413 3.04961 7.89401 2.98946 7.79377L2.01529 6.17011C1.95514 6.06987 1.92507 6.01975 1.92507 5.96437C1.92506 5.90899 1.95512 5.85886 2.01524 5.7586L2.9964 4.1224C3.0533 4.0275 3.08176 3.98005 3.12761 3.95408C3.17347 3.92811 3.2288 3.92811 3.33945 3.92811H5.32977C5.44036 3.92811 5.49566 3.92811 5.54151 3.90216C5.58735 3.87621 5.61581 3.82879 5.67273 3.73397L6.6619 2.08599C6.71881 1.99116 6.74727 1.94375 6.79312 1.9178C6.83896 1.89185 6.89426 1.89185 7.00486 1.89185H8.99529C9.10588 1.89185 9.16118 1.89185 9.20703 1.9178C9.25287 1.94375 9.28133 1.99116 9.33825 2.08599L10.3274 3.73397C10.3843 3.82879 10.4128 3.87621 10.4586 3.90216C10.5045 3.92811 10.5598 3.92811 10.6704 3.92811H12.6607C12.7713 3.92811 12.8267 3.92811 12.8725 3.95408C12.9184 3.98005 12.9468 4.0275 13.0037 4.1224L13.9849 5.7586C14.045 5.85886 14.0751 5.90899 14.0751 5.96437C14.0751 6.01975 14.045 6.06987 13.9849 6.17011L13.0107 7.79377Z" stroke="currentColor" stroke-miterlimit="10"></path></svg>'

    /** 注入的样式：与账号行同高的圆角图标+文字按钮，绝对定位在脚部行右端。 */
    const STYLE = [
      `[data-dsh-settings-row]{position:relative;box-sizing:border-box;}`,
      `.${BUTTON_CLASS}{position:absolute;top:50%;right:2px;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 10px;margin:0;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;white-space:nowrap;cursor:pointer;}`,
      `.${BUTTON_CLASS} .${ICON_CLASS}{display:inline-flex;flex:none;align-items:center;justify-content:center;}`,
      `.${BUTTON_CLASS} .${LABEL_CLASS}{overflow:hidden;text-overflow:ellipsis;}`,
      `@media (hover:hover){.${BUTTON_CLASS}:hover{background-color:var(--dsw-alias-interactive-bg-hover);}}`,
      `.${BUTTON_CLASS}:focus-visible{outline:2px solid var(--dsw-alias-text-accent);outline-offset:-2px;}`,
      `.${BUTTON_CLASS}[hidden]{display:none;}`,
      `body.${SUPPRESS_CLASS} [role="menu"]{opacity:0!important;transition:none!important;}`,
    ].join('')

    /** 已注入的按钮，卸载时移除。 */
    let injected
    /** 合并窗口的定时器句柄。 */
    let settleTimer
    /** 观察侧栏重渲染的观察器。 */
    let observer
    /** locale 订阅的退订函数。 */
    let offLocale
    /** resize 监听器引用。 */
    let onResize
    /** 当前 Client 上下文，供异步回调使用。 */
    let context

    /**
     * 读取宿主设置文案：与 ui-settings-general 的 TriggerContent 共用
     * settings 命名空间的 trigger 键，因此与账号菜单里的设置项逐字一致。
     * @param ctx - Client cordis 上下文。
     * @returns 文案；字典尚未注册时回退到内置词表首项。
     */
    function settingsLabel(ctx) {
      try {
        const translate = ctx.locale.bind('settings')
        const label = translate('trigger')
        if (typeof label === 'string' && label.length > 0 && label !== 'trigger') return label
      } catch {
        // 字典未就绪：走回退词表。
      }
      return FALLBACK_LABELS[0]
    }

    /**
     * 文本是否就是宿主设置入口的文案（较新版本自带触发按钮时用来识别它）。
     * @param text - 按钮文本。
     * @param label - 当前语言的设置文案。
     * @returns 是否匹配。
     */
    function isSettingsText(text, label) {
      const value = (text ?? '').trim()
      if (value.length === 0) return false
      return value === label || FALLBACK_LABELS.includes(value)
    }

    /**
     * 找到脚部的 triggerRow：SettingsRoot 用于「触发按钮 + 账号启动器」的 flex 行。
     * 类名是 CSS Modules 产物 `<hash>_triggerRow`，后缀稳定；找不到时回退为
     * 账号菜单按钮的 flex 祖先。
     * @returns 目标行；尚未渲染时 null。
     */
    function findTriggerRow() {
      if (typeof document === 'undefined') return null
      for (const row of document.querySelectorAll('[class*="_triggerRow"]')) {
        if (row.querySelector('button') !== null) return row
      }
      const account = document.querySelector('button[aria-label="账号菜单"]')
      if (account === null) return null
      let node = account.parentElement
      for (let depth = 0; node !== null && depth < 4; depth += 1, node = node.parentElement) {
        if (node.children.length >= 1 && window.getComputedStyle(node).display === 'flex') return node
      }
      return null
    }

    /** 宿主设置面板是否已经打开。 */
    function settingsOpen() {
      return document.querySelector('[class*="_overlay"] [class*="_panel"]') !== null
    }

    /**
     * 当前最顶层的弹窗名：与 dsh-client-shortcuts 派发快捷键时读的是同一份
     * 结构（最后一个 dialog 胜出，`data-shortcut-modal` 属性即名称，没有该
     * 属性的一律算 `other`）。
     * @returns 弹窗名；没有弹窗时 null。
     */
    function currentModal() {
      if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null
      const dialogs = document.querySelectorAll(MODAL_SELECTOR)
      const top = dialogs[dialogs.length - 1]
      if (top === undefined) return null
      return top.dataset.shortcutModal ?? 'other'
    }

    /**
     * 宿主是否已经把 `settings.open` 命令登记进快捷键注册表。ui-settings-general
     * 在 `sidebar.settings` 座位被注入时才注册它，所以这里只读、不假设。
     * @param registry - ShortcutsService 的 registry 字段。
     * @returns 命令是否可用。
     */
    function hasSettingsCommand(registry) {
      const commands = registry.commands
      return commands !== undefined && typeof commands.has === 'function' && commands.has('settings.open')
    }

    /**
     * 首选打开方式：直接派发宿主的 `settings.open` 命令。
     *
     * 该命令的 resolve 只认 `modal === null`（打开）与 `'settings'`（关闭），
     * 有别的弹窗在场时会被判为 blocked，所以这里先读当前弹窗再决定——绝不能
     * 把「应该打开」误发成「关闭」。invoke 本身没有返回值，是否真的生效由
     * 调用方随后检查界面。
     * @returns 命令是否已经派发出去。
     */
    function openViaCommand() {
      const registry = context?.shortcuts?.registry
      if (registry === undefined || registry === null || typeof registry.invoke !== 'function') return false
      if (!hasSettingsCommand(registry)) return false
      if (currentModal() !== null) return false
      try {
        registry.invoke('settings.open', { modal: null, region: 'page' })
        return true
      } catch {
        return false
      }
    }

    /**
     * 等待一小段时间，让菜单或面板完成渲染。
     * @param ms - 毫秒。
     * @returns 到点后兑现的 Promise。
     */
    function wait(ms) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
      })
    }

    /**
     * 回退打开方式：短暂打开账号菜单并点其中的设置项，菜单在 SUPPRESS_CLASS
     * 下不可见，因此用户只看到设置面板直接出现。只在 `settings.open` 命令
     * 不可用或派发后没生效时才会走到这里。
     * @param row - 脚部行，用于定位账号菜单按钮。
     * @param label - 设置文案。
     * @returns 是否点到了设置项。
     */
    async function openViaMenu(row, label) {
      if (settingsOpen()) return true
      const account = row.querySelector('button')
      if (account === null) return false
      const body = document.body
      body.classList.add(SUPPRESS_CLASS)
      window.setTimeout(() => {
        body.classList.remove(SUPPRESS_CLASS)
      }, OPEN_SETTLE_MS * 3)
      try {
        account.click()
        await wait(OPEN_SETTLE_MS)
        for (const item of document.querySelectorAll('[role="menu"] button, [role="menuitem"] button')) {
          if ((item.textContent ?? '').trim().startsWith(label)) {
            item.click()
            await wait(OPEN_SETTLE_MS)
            return true
          }
        }
        // 没找到设置项：把菜单收回去，避免留在打开状态。
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
        return false
      } finally {
        body.classList.remove(SUPPRESS_CLASS)
      }
    }

    /**
     * 打开设置：先派发宿主的 `settings.open` 命令；命令没生效（未注册、
     * 注册表被收紧，或派发后 240ms 内面板仍未出现）才回退到驱动账号菜单。
     * @param row - 脚部行，回退路径用它定位账号菜单按钮。
     * @param label - 设置文案。
     * @returns 是否成功打开了面板。
     */
    async function openSettings(row, label) {
      const modal = currentModal()
      if (settingsOpen() || modal === 'settings') return true
      // 有别的弹窗挡着：命令会被判 blocked，驱动菜单也点不动，直接不动。
      if (modal !== null) return false
      if (openViaCommand()) {
        for (let poll = 0; poll < COMMAND_POLLS; poll += 1) {
          await wait(COMMAND_SETTLE_MS)
          if (settingsOpen() || currentModal() === 'settings') return true
        }
      }
      return openViaMenu(row, label)
    }

    /**
     * 创建齿轮按钮：图标 + 文案，尺寸由 syncMetrics 对齐到旁边账号行。
     * @param label - 无障碍名称与可见文案。
     * @param locateRow - 点击时重新定位脚部行的回调（React 可能重建该行）。
     * @returns 按钮元素。
     */
    function createButton(label, locateRow) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = BUTTON_CLASS
      button.dataset.dshSettingsButton = ''
      button.setAttribute('aria-label', label)
      button.title = label
      const icon = document.createElement('span')
      icon.className = ICON_CLASS
      icon.innerHTML = GEAR_SVG
      const text = document.createElement('span')
      text.className = LABEL_CLASS
      text.textContent = label
      button.append(icon, text)
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const row = locateRow()
        if (row === null) return
        void openSettings(row, label)
      })
      return button
    }

    /**
     * 把按钮的尺寸与文案对齐到旁边账号行：高度取账号按钮的实测高度，
     * 因此展开态看起来与用户栏同高，折叠动画或缩放后也会自动跟上。
     * @param row - 脚部行。
     * @param button - 注入的按钮。
     * @param label - 当前语言的设置文案。
     */
    function syncMetrics(row, button, label) {
      const account = Array.from(row.querySelectorAll('button')).find((node) => node !== button)
      const height = account === undefined ? 0 : Math.round(account.getBoundingClientRect().height)
      if (height > 0) {
        const value = `${height}px`
        if (button.style.height !== value) button.style.height = value
      }
      const text = button.querySelector(`.${LABEL_CLASS}`)
      if (text !== null && text.textContent !== label) text.textContent = label
    }

    /** 保证样式只注入一次。 */
    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-settings-button'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = STYLE
      document.head.appendChild(tag)
    }

    /** 执行一次装配：识别宿主按钮或注入齿轮。 */
    function settle() {
      settleTimer = undefined
      if (context === undefined || typeof document === 'undefined') return
      const label = settingsLabel(context)
      const row = findTriggerRow()
      if (row === null) return
      // 较新版本的宿主自带触发按钮：只把它排到行尾，不再注入第二个齿轮。
      // 必须排除本插件注入的按钮：它自己的文案就是「设置」，否则会把自己
      // 当成宿主按钮删掉再重建，形成一直闪烁的循环。
      const hostTrigger = Array.from(row.querySelectorAll('button')).find(
        (node) => !node.classList.contains(BUTTON_CLASS) && isSettingsText(node.textContent, label),
      )
      if (hostTrigger !== undefined) {
        if (hostTrigger.style.order !== HOST_TRIGGER_ORDER) hostTrigger.style.order = HOST_TRIGGER_ORDER
        if (injected !== undefined && injected.parentElement !== null) injected.remove()
        injected = undefined
        return
      }
      let button = row.querySelector(`:scope > .${BUTTON_CLASS}`)
      if (button === null) {
        button = createButton(label, () => findTriggerRow())
        row.appendChild(button)
      }
      injected = button
      row.dataset.dshSettingsRow = ''
      syncMetrics(row, button, label)
      // 齿轮绝对定位在行右端，行只预留它的宽度，账号行本身不被覆盖，
      // 也不会因为按钮存在与否而反复挤压重排。
      const narrow = row.getBoundingClientRect().width < RAIL_MAX_WIDTH
      button.hidden = narrow
      if (narrow) {
        if (row.style.paddingRight !== '') row.style.paddingRight = ''
      } else {
        const reserve = `${Math.ceil(button.getBoundingClientRect().width) + 8}px`
        if (row.style.paddingRight !== reserve) row.style.paddingRight = reserve
      }
    }

    /** 合并连续的 DOM 变更，避免每次重渲染都重排。 */
    function schedule() {
      if (settleTimer !== undefined) return
      settleTimer = window.setTimeout(settle, SETTLE_MS)
    }

    /** 移除注入的按钮与样式，并断开全部监听。 */
    function teardown() {
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer)
        settleTimer = undefined
      }
      if (observer !== undefined) {
        observer.disconnect()
        observer = undefined
      }
      if (offLocale !== undefined) {
        offLocale()
        offLocale = undefined
      }
      if (onResize !== undefined) {
        window.removeEventListener('resize', onResize)
        onResize = undefined
      }
      if (injected !== undefined) {
        const row = injected.parentElement
        if (row !== null) {
          row.style.paddingRight = ''
          delete row.dataset.dshSettingsRow
        }
        injected.remove()
      }
      injected = undefined
      document.body.classList.remove(SUPPRESS_CLASS)
      document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)?.remove()
    }

    /**
     * 脚部空座位：不绘制任何内容，只让插件在 Slots 检查里可见。
     * @returns 永远为 null。
     */
    function FooterAnchor() {
      return null
    }

    return {
      inject: ['slots', 'locale', 'shortcuts'],
      /**
       * 装配脚部齿轮。
       * @param ctx - Client cordis 上下文。
       */
      apply(ctx) {
        context = ctx
        ctx.effect(() => {
          ensureStyles()
          settle()
          observer = new MutationObserver(schedule)
          observer.observe(document.body, { childList: true, subtree: true })
          offLocale = ctx.locale.subscribe(schedule)
          onResize = schedule
          window.addEventListener('resize', onResize)
          const offSlot = ctx.slots.inject('sidebar.footer.action', () =>
            ctx.slots.register(
              { name: 'sidebar.footer.action', id: 'settings-button', order: 1000 },
              FooterAnchor,
            ),
          )
          return () => {
            offSlot()
            teardown()
          }
        }, 'dsh-settings-button: settings gear beside the account avatar')
      },
    }
  },
})
