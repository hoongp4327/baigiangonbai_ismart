/* Bài mẫu và prompt mẫu cho giáo viên. */
const SAMPLE_LESSON = {
  title: 'Unit 5 - My Pets',
  grade: 3,
  unit: 'Unit 5',
  description: 'Ôn tập từ vựng và mẫu câu về thú cưng.',
  questions: [
    { type: 'multiple_choice', skill: 'vocabulary', prompt: 'Đây là con gì?', image: '🐶', options: ['cat', 'dog', 'bird'], answer: 1, explanation: 'dog = con chó' },
    { type: 'multiple_choice', skill: 'listening', prompt: 'Nghe và chọn con vật đúng.', audio_text: 'It is a rabbit.', options: ['🐱 cat', '🐰 rabbit', '🐟 fish'], answer: 1, explanation: 'Em nghe được: "It is a rabbit."' },
    { type: 'true_false', skill: 'vocabulary', prompt: 'This is a bird.', image: '🐟', answer: false, explanation: 'Đây là con cá: fish.' },
    { type: 'fill_blank', skill: 'grammar', prompt: 'I have two ___ .', image: '🐱🐱', answer: ['cats'], explanation: 'Hai con trở lên thì thêm "s": cats.' },
    {
      type: 'matching',
      skill: 'vocabulary',
      prompt: 'Nối từ tiếng Anh với nghĩa tiếng Việt.',
      pairs: [
        { left: 'dog', right: 'con chó' },
        { left: 'cat', right: 'con mèo' },
        { left: 'bird', right: 'con chim' },
        { left: 'fish', right: 'con cá' },
      ],
    },
    { type: 'word_order', skill: 'grammar', prompt: 'Sắp xếp các từ thành câu đúng.', answer: 'I have a dog', explanation: 'I have a dog. = Tớ có một con chó.' },
    { type: 'fill_blank', skill: 'listening', prompt: 'Nghe và viết lại từ em nghe được.', audio_text: 'parrot', answer: ['parrot'], explanation: 'parrot = con vẹt' },
    { type: 'multiple_choice', skill: 'grammar', prompt: 'How many dogs do you have? - I have ___ dogs.', image: '🐶🐶🐶', options: ['two', 'three', 'four'], answer: 1, explanation: 'Có 3 con chó: three.' },
    { type: 'multiple_choice', skill: 'reading', prompt: 'What colour is Mimi?', passage: 'This is my cat. Its name is Mimi. It is white. It likes fish.', options: ['black', 'white', 'brown'], answer: 1, explanation: 'Trong bài: "It is white."' },
    { type: 'word_order', skill: 'grammar', prompt: 'Sắp xếp các từ thành câu hỏi đúng.', answer: 'Do you have any rabbits?', explanation: 'Do you have any rabbits? = Bạn có con thỏ nào không?' },
  ],
};

const PROMPT_TEMPLATE = `Bạn là giáo viên tiếng Anh phổ thông ở Việt Nam. Dựa trên nội dung bài học tôi gửi kèm (ảnh trang sách hoặc văn bản), hãy soạn một bài ôn tập về nhà gồm 10-12 câu, độ khó vừa sức học sinh lớp [ĐIỀN LỚP].

CHỈ trả về MỘT khối JSON hợp lệ, không thêm lời giải thích, theo đúng cấu trúc sau:

{
  "title": "Tên bài, ví dụ: Unit 5 - My Pets",
  "grade": 3,
  "unit": "Unit 5",
  "description": "Mô tả ngắn",
  "questions": [ ... ]
}

Mỗi câu hỏi có các trường chung:
- "type": một trong 5 dạng bên dưới
- "skill": "vocabulary" | "grammar" | "listening" | "reading" | "writing"
- "prompt": đề bài (hướng dẫn viết bằng tiếng Việt, ngắn gọn)
- "explanation": giải thích ngắn bằng tiếng Việt, hiện ra sau khi học sinh trả lời
- "image" (BẮT BUỘC ở mọi câu): 1-3 emoji minh hoạ cho nội dung câu hỏi, ví dụ "🐶". Emoji KHÔNG được để lộ đáp án; với câu nghe dùng "🎧"
- "audio_text" (tuỳ chọn): câu tiếng Anh để máy đọc to. Dùng cho bài nghe; khi đó KHÔNG được để lộ đáp án trong "prompt"
- "passage" (tuỳ chọn): đoạn văn ngắn 2-4 câu cho bài đọc

5 dạng bài:
1. Trắc nghiệm:   {"type":"multiple_choice","options":["cat","dog","bird"],"answer":1}   ("answer" là vị trí đáp án đúng, bắt đầu từ 0; dùng 3 lựa chọn)
2. Đúng / Sai:    {"type":"true_false","answer":false}
3. Điền từ:       {"type":"fill_blank","prompt":"I have two ___ .","answer":["cats"]}   ("answer" là danh sách các đáp án được chấp nhận; chỗ trống ghi ___)
4. Nối cặp:       {"type":"matching","pairs":[{"left":"dog","right":"con chó"},{"left":"cat","right":"con mèo"}]}   (3-5 cặp)
5. Sắp xếp câu:   {"type":"word_order","answer":"I have a dog"}   (chỉ ghi câu đúng, hệ thống tự xáo trộn từ)

Yêu cầu:
- Dùng đủ cả 5 dạng bài, có ít nhất 2 câu nghe (có "audio_text") và 1 câu đọc (có "passage").
- Chỉ dùng từ vựng và mẫu câu có trong bài học tôi gửi.
- Mỗi câu chỉ có một đáp án đúng rõ ràng.
- "grade" ghi đúng số lớp tôi nêu ở trên; độ dài câu và đoạn đọc phải hợp với lớp đó.`;
