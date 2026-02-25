export type Locale = 'en' | 'zh';

export type I18nKey =
  | 'welcome'
  | 'homeTitle'
  | 'homeHint'
  | 'noEndpointTitle'
  | 'noEndpointHint'
  | 'selectEndpoint'
  | 'switchEndpoint'
  | 'addEndpoint'
  | 'editEndpoint'
  | 'editAction'
  | 'settings'
  | 'settingsTitle'
  | 'projectListTitle'
  | 'openChat'
  | 'newProjectTitle'
  | 'projectDirLabel'
  | 'projectDirPlaceholder'
  | 'endpointNameLabel'
  | 'endpointNamePlaceholder'
  | 'endpointNameRequired'
  | 'endpointAddressLabel'
  | 'gatewayErrorPrefix'
  | 'unknownError'
  | 'connectionFailed'
  | 'statusConnected'
  | 'statusConnecting'
  | 'statusError'
  | 'statusIdle'
  | 'loadingSession'
  | 'statusLabel'
  | 'sessionLabel'
  | 'placeholder'
  | 'send'
  | 'stop'
  | 'languageLabel'
  | 'gatewayLabel'
  | 'setGateway'
  | 'setGatewayTitle'
  | 'setGatewayHint'
  | 'gatewayPlaceholder'
  | 'save'
  | 'cancel'
  | 'invalidGateway'
  | 'gatewayHealthFailed'
  | 'thinking'
  | 'sessionCreateFailed'
  | 'promptSubmitFailed'
  | 'replyPending'
  | 'requestCancelled'
  | 'projectDirsLoading'
  | 'projectDirsEmpty'
  | 'projectDirsError'
  | 'projectLoadMore'
  | 'projectLoadingMore'
  | 'projectNoMore'
  | 'permissionTitle'
  | 'permissionHint'
  | 'permissionTypeLabel'
  | 'permissionPathLabel'
  | 'permissionPatternLabel'
  | 'permissionAllowOnce'
  | 'permissionAllowAlways'
  | 'permissionReject'
  | 'permissionRejectReasonPlaceholder'
  | 'permissionConfirmReject'
  | 'permissionCancelReject'
  | 'permissionReplyFailed'
  | 'permissionResolvedOnce'
  | 'permissionResolvedAlways'
  | 'permissionResolvedReject'
  | 'questionTitle'
  | 'questionSubmit'
  | 'questionReject'
  | 'questionCustomPlaceholder'
  | 'questionReplyFailed'
  | 'questionRejectFailed'
  | 'questionResolved'
  | 'questionRejected'
  | 'questionAnswerRequired'
  | 'imageOnlyMessage'
  | 'imagePermissionDenied'
  | 'imageReadFailed';

export const translations: Record<Locale, Record<I18nKey, string>> = {
  en: {
    welcome: 'Mobile client is ready. Send a message to your OpenCode gateway.',
    homeTitle: 'Choose endpoint',
    homeHint: 'Select the computer endpoint you want to operate.',
    noEndpointTitle: 'No endpoint yet',
    noEndpointHint: 'Add at least one OpenCode endpoint before starting.',
    selectEndpoint: 'Open',
    switchEndpoint: 'Switch',
    addEndpoint: 'Add endpoint',
    editEndpoint: 'Edit endpoint',
    editAction: 'Edit',
    settings: 'Settings',
    settingsTitle: 'Settings',
    projectListTitle: 'Projects',
    openChat: 'New project',
    newProjectTitle: 'New project',
    projectDirLabel: 'Project directory',
    projectDirPlaceholder: '/Users/name/code/my-project',
    endpointNameLabel: 'Endpoint name',
    endpointNamePlaceholder: 'e.g. Work MacBook',
    endpointNameRequired: 'Please enter an endpoint name.',
    endpointAddressLabel: 'Endpoint Base URL',
    gatewayErrorPrefix: 'Gateway error',
    unknownError: 'Unknown error',
    connectionFailed: 'Connection failed. Check WS_URL and gateway availability.',
    statusConnected: 'Connected',
    statusConnecting: 'Connecting',
    statusError: 'Connection error',
    statusIdle: 'Idle',
    loadingSession: 'Initializing...',
    statusLabel: 'Status',
    sessionLabel: 'Session',
    placeholder: 'Type a message for OpenCode',
    send: 'Send',
    stop: 'Stop',
    languageLabel: 'Language',
    gatewayLabel: 'Gateway',
    setGateway: 'Set',
    setGatewayTitle: 'Set OpenCode gateway base address',
    setGatewayHint: 'Use Base URL. Example: http://127.0.0.1:4096',
    gatewayPlaceholder: 'http://127.0.0.1:4096',
    save: 'Save',
    cancel: 'Cancel',
    invalidGateway: 'Please enter a valid Base URL.',
    gatewayHealthFailed: 'Cannot reach OpenCode server. Check Base URL and service status.',
    thinking: 'Thinking...',
    sessionCreateFailed: 'Failed to create OpenCode session.',
    promptSubmitFailed: 'Failed to submit prompt to OpenCode.',
    replyPending: 'Request submitted. Waiting for reply in OpenCode session...',
    requestCancelled: 'Request cancelled.',
    projectDirsLoading: 'Loading project directories...',
    projectDirsEmpty: 'No project directories found.',
    projectDirsError: 'Failed to load project directories.',
    projectLoadMore: 'Load more',
    projectLoadingMore: 'Loading more projects...',
    projectNoMore: 'No more projects.',
    permissionTitle: 'Permission request',
    permissionHint: 'OpenCode requests access outside the project.',
    permissionTypeLabel: 'Type',
    permissionPathLabel: 'Path',
    permissionPatternLabel: 'Patterns',
    permissionAllowOnce: 'Allow once',
    permissionAllowAlways: 'Always allow',
    permissionReject: 'Reject',
    permissionRejectReasonPlaceholder: 'Reason (optional)',
    permissionConfirmReject: 'Confirm reject',
    permissionCancelReject: 'Cancel',
    permissionReplyFailed: 'Failed to submit permission reply. Please retry.',
    permissionResolvedOnce: 'Allowed this permission request once.',
    permissionResolvedAlways: 'Always allowed this permission pattern for this instance.',
    permissionResolvedReject: 'Rejected this permission request.',
    questionTitle: 'Question from OpenCode',
    questionSubmit: 'Submit answer',
    questionReject: 'Reject request',
    questionCustomPlaceholder: 'Type a custom answer',
    questionReplyFailed: 'Failed to submit answer. Please retry.',
    questionRejectFailed: 'Failed to reject question request. Please retry.',
    questionResolved: 'Submitted answers to OpenCode question request.',
    questionRejected: 'Rejected OpenCode question request.',
    questionAnswerRequired: 'Please answer every question before submitting.',
    imageOnlyMessage: '[Image]',
    imagePermissionDenied: 'Photo library permission is required to pick images.',
    imageReadFailed: 'Failed to read selected image. Please try another one.',
  },
  zh: {
    welcome: '移动端已就绪。请输入消息并发送到 OpenCode 网关。',
    homeTitle: '选择端点',
    homeHint: '请选择要操作的电脑端点。',
    noEndpointTitle: '还没有端点',
    noEndpointHint: '请先添加至少一个 OpenCode 端点。',
    selectEndpoint: '进入',
    switchEndpoint: '切换',
    addEndpoint: '新增端点',
    editEndpoint: '编辑端点',
    editAction: 'Edit',
    settings: '设置',
    settingsTitle: '设置',
    projectListTitle: '项目列表',
    openChat: '新建项目',
    newProjectTitle: '新建项目',
    projectDirLabel: '项目目录',
    projectDirPlaceholder: '/Users/name/code/my-project',
    endpointNameLabel: '端点名称',
    endpointNamePlaceholder: '例如：公司电脑',
    endpointNameRequired: '请输入端点名称。',
    endpointAddressLabel: '端点 Base URL',
    gatewayErrorPrefix: '网关错误',
    unknownError: '未知错误',
    connectionFailed: '连接失败，请检查 WS_URL 或网关服务状态。',
    statusConnected: '已连接',
    statusConnecting: '连接中',
    statusError: '连接异常',
    statusIdle: '待连接',
    loadingSession: '初始化中...',
    statusLabel: '状态',
    sessionLabel: '会话',
    placeholder: '输入给 OpenCode 的消息',
    send: '发送',
    stop: '停止',
    languageLabel: '语言',
    gatewayLabel: '网关',
    setGateway: '设置',
    setGatewayTitle: '请设置 OpenCode 网关基础地址',
    setGatewayHint: '请输入 Base URL，例如 http://127.0.0.1:4096',
    gatewayPlaceholder: 'http://127.0.0.1:4096',
    save: '保存',
    cancel: '取消',
    invalidGateway: '请输入有效的 Base URL。',
    gatewayHealthFailed: '无法连接 OpenCode 服务，请检查 Base URL 和服务状态。',
    thinking: '思考中...',
    sessionCreateFailed: '创建 OpenCode 会话失败。',
    promptSubmitFailed: '提交消息到 OpenCode 失败。',
    replyPending: '请求已提交，请稍后在会话中查看回复。',
    requestCancelled: '请求已取消。',
    projectDirsLoading: '正在加载项目目录...',
    projectDirsEmpty: '未获取到项目目录。',
    projectDirsError: '获取项目目录失败。',
    projectLoadMore: '加载更多',
    projectLoadingMore: '正在加载更多项目...',
    projectNoMore: '没有更多项目了。',
    permissionTitle: '权限请求',
    permissionHint: 'OpenCode 请求访问项目外目录。',
    permissionTypeLabel: '类型',
    permissionPathLabel: '路径',
    permissionPatternLabel: '匹配模式',
    permissionAllowOnce: '允许一次',
    permissionAllowAlways: '长期允许',
    permissionReject: '拒绝',
    permissionRejectReasonPlaceholder: '拒绝原因（可选）',
    permissionConfirmReject: '确认拒绝',
    permissionCancelReject: '取消',
    permissionReplyFailed: '提交权限处理失败，请重试。',
    permissionResolvedOnce: '已允许本次权限请求。',
    permissionResolvedAlways: '已在当前实例中长期允许该权限模式。',
    permissionResolvedReject: '已拒绝该权限请求。',
    questionTitle: 'OpenCode 问题确认',
    questionSubmit: '提交答案',
    questionReject: '拒绝请求',
    questionCustomPlaceholder: '输入自定义答案',
    questionReplyFailed: '提交答案失败，请重试。',
    questionRejectFailed: '拒绝问题请求失败，请重试。',
    questionResolved: '已提交问题答案。',
    questionRejected: '已拒绝问题请求。',
    questionAnswerRequired: '请先完成每个问题的选择或输入。',
    imageOnlyMessage: '[图片]',
    imagePermissionDenied: '需要相册权限才能选择图片。',
    imageReadFailed: '读取所选图片失败，请换一张再试。',
  },
};

export function detectLocale(): Locale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith('zh') ? 'zh' : 'en';
}
