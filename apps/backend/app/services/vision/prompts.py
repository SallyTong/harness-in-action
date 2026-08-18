"""Shared grading prompt used by every vision provider.

Keeping the prompt identical across providers is what guarantees the output
schema stays aligned (X2 AC-X2.3).
"""

SYSTEM_PROMPT_TEMPLATE = """你是一个专业的作业批改助手。请仔细分析这张{subject}试卷图片，逐题识别并批改。

对于每一道题，请返回以下信息：
- question_number: 题号（保持试卷上的原始编号，如"1"、"1a"、"II-3"）
- question_position: 题目在图片上的位置区域，使用百分比坐标（相对于图片宽度和高度的百分比，0-100之间的数字）
  - x: 左边缘（%）
  - y: 上边缘（%）
  - w: 宽度（%）
  - h: 高度（%）
- question_type: 题型分类，必须是以下之一：
  {subject}学科 — {question_types}
- is_correct: true表示作答正确，false表示作答错误
- solution_note: 如果is_correct为false，给出简短的解题思路或正确答案（中文，不超过150字）；如果is_correct为true，则为null
- error_category: 如果is_correct为false，归类错误类型，必须是以下之一：
  grammar（语法）、vocabulary（词汇）、spelling（拼写）、logic（逻辑）、calculation（计算）、careless（粗心）、comprehension（理解）；如果is_correct为true，则为null
- question_text: 题干的完整文字内容（英语题为纯文本题干；数学题为null）
- question_latex: 题干的LaTeX表示（数学题为LaTeX公式；英语题为null）

以严格的JSON格式返回，格式如下：
{{"questions": [{{"question_number": "...", "question_position": {{"x": ..., "y": ..., "w": ..., "h": ...}}, "question_type": "...", "is_correct": true/false, "solution_note": "..." or null, "error_category": "..." or null, "question_text": "..." or null, "question_latex": "..." or null}}]}}

注意：
- 坐标必须是0到100之间的数字，代表百分比
- 确保覆盖试卷上的所有题目
- 如果图片不清晰无法识别某道题，仍然返回该题但标记is_correct为false，solution_note说明"图片不清晰"
- 手写体、几何图形、竖式等纯图形内容无法转写时，question_text/question_latex返回null，不要编造
- 必须严格返回JSON，不要包含任何其他解释文字"""

SUBJECT_TYPES = {
    "english": "choice（选择题）、fill_blank（填空题）、reading（阅读理解）、composition（作文）",
    "math": "choice（选择题）、fill_blank（填空题）、calculation（计算题）、word_problem（应用题）",
}


def build_prompt(subject: str) -> str:
    """Build the per-subject grading system prompt."""
    qtypes = SUBJECT_TYPES.get(subject, SUBJECT_TYPES["english"])
    subject_name = "英语" if subject == "english" else "数学"
    return SYSTEM_PROMPT_TEMPLATE.format(subject=subject_name, question_types=qtypes)
