from backend.services.translation import _contains_cjk, detect_and_translate_if_needed


def test_contains_cjk_detection():
    assert _contains_cjk("你好") is True
    assert _contains_cjk("Hello") is False


def test_detect_and_translate_empty_text():
    text, language, translated = detect_and_translate_if_needed("", "yue")
    assert text == ""
    assert language == "Unknown"
    assert translated is False
