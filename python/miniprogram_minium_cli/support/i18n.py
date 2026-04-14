"""面向 CLI 可读消息的轻量多语言支持。"""

from __future__ import annotations

from typing import Any

_CURRENT_LANGUAGE = "en-US"

_MESSAGES = {
    "en-US": {
        "error.unsupported_command": "Unsupported command: {command}",
        "error.protocol_mismatch": "Protocol version mismatch.",
        "error.request_payload_missing": "Request payload is missing.",
        "error.request_plan_missing": "Request payload is missing `plan`.",
        "error.step_not_implemented": "Step type is not implemented yet: {step_type}",
        "error.session_required": "A valid session is required for this step.",
        "error.invalid_session": "Invalid or expired session.",
        "error.page_path_assertion_failed": "Page path assertion failed.",
        "error.element_text_assertion_failed": "Element text assertion failed.",
        "error.element_visibility_assertion_failed": "Element visibility assertion failed.",
        "error.pointer_already_active": "Pointer is already active.",
        "error.pointer_not_active": "Pointer is not active.",
        "error.pointer_id_invalid": "pointerId must be >= 0.",
        "error.pointer_limit": "Only up to two active pointers are supported.",
        "error.locator_input_object": "Locator input must be an object.",
        "error.unsupported_locator_type": "Unsupported locator type.",
        "error.locator_value_empty": "Locator value cannot be empty.",
        "error.locator_index_invalid": "Locator index must be >= 0.",
        "error.wait_input_object": "Wait condition input must be an object.",
        "error.unsupported_wait_kind": "Unsupported wait condition kind.",
        "error.page_path_expected_value": "page_path_equals requires expectedValue.",
        "error.wait_requires_locator": "{kind} requires locator.",
        "error.timeout_ms_invalid": "timeoutMs must be >= 1.",
        "error.gesture_target_required": "Gesture target is required.",
        "error.gesture_target_object": "Gesture target must be an object.",
        "error.gesture_raw_injection": "Raw gesture injection is not supported.",
        "error.gesture_target_coordinates": "Gesture target requires a locator or numeric x/y coordinates.",
        "error.element_not_interactable": "Element is not interactable.",
        "error.wait_timed_out": "Wait condition timed out.",
        "error.gesture_target_resolved_coordinates": "Gesture target requires resolved coordinates.",
        "error.minium_import_failed": "Failed to import Minium.",
        "error.devtool_missing": "WeChat DevTools path is missing or not accessible.",
        "error.project_path_missing": "Mini program project path is missing.",
        "error.project_config_missing": "Mini program project.config.json is missing.",
        "error.minium_connect_failed": "Failed to connect to the Minium runtime.",
        "error.devtool_prepare_failed": "Failed to prepare WeChat DevTools automation.",
        "error.minium_tap_not_supported": "The Minium runtime does not expose a tap primitive for this target.",
        "error.minium_touch_not_supported": "The Minium runtime does not expose the requested touch primitive.",
        "error.no_matching_element": "No matching element was found.",
        "error.bridge_runtime_unavailable": "Bridge action runtime is not available.",
        "error.bridge_async_timeout": "Bridge action timed out while waiting for an async response.",
        "error.bridge_action_failed": "Bridge action failed.",
        "error.network_input_object": "Network step input must be an object.",
        "error.network_matcher_required": "Network matcher is required.",
        "error.network_matcher_object": "Network matcher must be an object.",
        "error.network_matcher_field_object": "{field_name} must be an object.",
        "error.network_resource_type_invalid": "Unsupported network resource type.",
        "error.network_status_code_invalid": "statusCode must be numeric.",
        "error.network_numeric_invalid": "Numeric network field is invalid.",
        "error.network_max_events_invalid": "maxEvents must be numeric.",
        "error.network_event_invalid": "Unsupported network event type.",
        "error.network_wait_target_required": "network.wait requires listenerId or matcher.",
        "error.network_assert_count_conflict": "count cannot be combined with minCount or maxCount.",
        "error.network_intercept_behavior_object": "Network intercept behavior must be an object.",
        "error.network_intercept_action_invalid": "Unsupported network intercept action.",
        "error.network_delay_required": "delay actions require delayMs.",
        "error.network_mock_response_object": "Mock response must be an object.",
        "error.network_listener_missing": "Network listener was not found.",
        "error.network_rule_missing": "Network interception rule was not found.",
        "error.network_wait_timed_out": "Waiting for network activity timed out.",
        "error.network_assertion_failed": "Network assertion failed.",
        "error.network_runtime_unavailable": "Network controls are not available in the current runtime.",
    },
    "zh-CN": {
        "error.unsupported_command": "不支持的命令：{command}",
        "error.protocol_mismatch": "协议版本不匹配。",
        "error.request_payload_missing": "请求缺少 payload。",
        "error.request_plan_missing": "请求 payload 缺少 `plan`。",
        "error.step_not_implemented": "当前步骤类型尚未实现：{step_type}",
        "error.session_required": "当前步骤需要有效会话。",
        "error.invalid_session": "会话无效或已过期。",
        "error.page_path_assertion_failed": "页面路径断言失败。",
        "error.element_text_assertion_failed": "元素文本断言失败。",
        "error.element_visibility_assertion_failed": "元素可见性断言失败。",
        "error.pointer_already_active": "该触点已经处于激活状态。",
        "error.pointer_not_active": "该触点当前未激活。",
        "error.pointer_id_invalid": "pointerId 必须大于等于 0。",
        "error.pointer_limit": "当前最多只支持两个活跃触点。",
        "error.locator_input_object": "定位器输入必须是对象。",
        "error.unsupported_locator_type": "不支持的定位器类型。",
        "error.locator_value_empty": "定位器取值不能为空。",
        "error.locator_index_invalid": "定位器 index 必须大于等于 0。",
        "error.wait_input_object": "等待条件输入必须是对象。",
        "error.unsupported_wait_kind": "不支持的等待条件类型。",
        "error.page_path_expected_value": "page_path_equals 需要提供 expectedValue。",
        "error.wait_requires_locator": "{kind} 需要提供 locator。",
        "error.timeout_ms_invalid": "timeoutMs 必须大于等于 1。",
        "error.gesture_target_required": "手势目标不能为空。",
        "error.gesture_target_object": "手势目标必须是对象。",
        "error.gesture_raw_injection": "当前不支持原始手势事件注入。",
        "error.gesture_target_coordinates": "手势目标需要 locator 或数值型 x/y 坐标。",
        "error.element_not_interactable": "元素当前不可交互。",
        "error.wait_timed_out": "等待条件超时。",
        "error.gesture_target_resolved_coordinates": "手势目标需要可解析的坐标。",
        "error.minium_import_failed": "导入 Minium 失败。",
        "error.devtool_missing": "微信开发者工具路径缺失或不可访问。",
        "error.project_path_missing": "小程序项目路径缺失。",
        "error.project_config_missing": "缺少小程序 project.config.json。",
        "error.minium_connect_failed": "连接 Minium 运行时失败。",
        "error.devtool_prepare_failed": "准备微信开发者工具自动化环境失败。",
        "error.minium_tap_not_supported": "当前 Minium 运行时没有暴露该目标的 tap 原语。",
        "error.minium_touch_not_supported": "当前 Minium 运行时没有暴露所请求的触摸原语。",
        "error.no_matching_element": "未找到匹配的元素。",
        "error.bridge_runtime_unavailable": "桥接动作运行时当前不可用。",
        "error.bridge_async_timeout": "桥接动作等待异步结果超时。",
        "error.bridge_action_failed": "桥接动作执行失败。",
        "error.network_input_object": "网络步骤输入必须是对象。",
        "error.network_matcher_required": "网络 matcher 不能为空。",
        "error.network_matcher_object": "网络 matcher 必须是对象。",
        "error.network_matcher_field_object": "{field_name} 必须是对象。",
        "error.network_resource_type_invalid": "不支持的网络资源类型。",
        "error.network_status_code_invalid": "statusCode 必须是数值。",
        "error.network_numeric_invalid": "网络数值字段不合法。",
        "error.network_max_events_invalid": "maxEvents 必须是数值。",
        "error.network_event_invalid": "不支持的网络事件类型。",
        "error.network_wait_target_required": "network.wait 需要提供 listenerId 或 matcher。",
        "error.network_assert_count_conflict": "count 不能和 minCount 或 maxCount 同时使用。",
        "error.network_intercept_behavior_object": "网络拦截 behavior 必须是对象。",
        "error.network_intercept_action_invalid": "不支持的网络拦截动作。",
        "error.network_delay_required": "delay 动作需要提供 delayMs。",
        "error.network_mock_response_object": "mock 响应必须是对象。",
        "error.network_listener_missing": "未找到对应的网络监听器。",
        "error.network_rule_missing": "未找到对应的网络拦截规则。",
        "error.network_wait_timed_out": "等待网络活动超时。",
        "error.network_assertion_failed": "网络断言失败。",
        "error.network_runtime_unavailable": "当前运行时暂不支持网络控制能力。",
    },
}


def set_language(language: str | None) -> None:
    """设置当前执行期语言。"""
    global _CURRENT_LANGUAGE
    if isinstance(language, str) and language.lower().startswith("zh"):
        _CURRENT_LANGUAGE = "zh-CN"
    else:
        _CURRENT_LANGUAGE = "en-US"


def get_language() -> str:
    """获取当前执行期语言。"""
    return _CURRENT_LANGUAGE


def t(key: str, **params: Any) -> str:
    """返回本地化消息。"""
    template = _MESSAGES.get(_CURRENT_LANGUAGE, _MESSAGES["en-US"]).get(key, key)
    return template.format(**params)
