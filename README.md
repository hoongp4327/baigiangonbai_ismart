# Bài Giảng Số

Web ôn tập tiếng Anh tại nhà. Giáo viên nhờ AI soạn bài ra file JSON, import vào trang quản trị, gửi link cho học sinh và xem báo cáo.

## Chạy trên máy

Cần Node.js. Mở terminal trong thư mục này:

```bash
npm install
```

```bash
npm run dev
```

Rồi mở http://localhost:8765 (học sinh) hoặc http://localhost:8765/admin.html (giáo viên).

## Các lệnh

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy thử trên máy, sửa code là trang tự cập nhật |
| `npm test` | Chạy bộ kiểm thử tự động (chấm điểm, kiểm tra JSON, báo cáo) |
| `npm run build` | Kiểm tra lỗi kiểu rồi tạo thư mục `dist/` để đưa lên mạng |

Thư mục `dist/` là thứ cần tải lên nơi lưu trữ web. Sau khi build vẫn sửa được `dist/config.js` mà không cần build lại.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `public/config.js` | Địa chỉ Google Sheets. Để trống thì chạy chế độ demo |
| `src/lib/grade.ts` | Quy tắc chấm 5 dạng bài |
| `src/lib/validate.ts` | Kiểm tra file JSON giáo viên import |
| `src/lib/report.ts` | Tính báo cáo, lọc theo ngày, xuất Excel |
| `src/lib/sample.ts` | Bài mẫu và prompt mặc định cho AI |
| `src/store/` | Lớp dữ liệu: `local.ts` (demo) và `remote.ts` (Google Sheets) |
| `src/student/` | Trang học sinh |
| `src/admin/` | Trang giáo viên |
| `apps-script/Code.gs` | Máy chủ chạy trong Google Sheets, xem `HUONG-DAN-GOOGLE-SHEETS.md` |
| `sample/` | File JSON bài học mẫu |
| `legacy/` | Bản HTML/JS đầu tiên, giữ lại để tham khảo |

## Khi thêm dạng bài mới

Quy tắc chấm nằm ở hai nơi và phải khớp nhau: `src/lib/grade.ts` (báo đúng/sai ngay cho học sinh) và hàm `grade()` trong `apps-script/Code.gs` (điểm chính thức khi nộp bài). Sửa `Code.gs` xong phải triển khai lại trên Google.
