# Nối Bài Giảng Số với Google Sheets

Làm một lần, mất khoảng 10 phút. Cần một tài khoản Google.

## 1. Tạo Sheet và dán mã máy chủ

1. Vào https://sheets.new để tạo một Google Sheet mới. Đặt tên, ví dụ "Bài Giảng Số - Dữ liệu".
2. Trên thanh menu chọn **Tiện ích mở rộng → Apps Script**.
3. Xoá hết nội dung đang có trong ô soạn thảo, rồi dán toàn bộ nội dung file `apps-script/Code.gs` vào.
4. Ở dòng `const MAT_KHAU_GV = 'doi-mat-khau-nay';` đổi `doi-mat-khau-nay` thành mật khẩu của bạn. Đây là mật khẩu vào trang giáo viên.
5. Bấm biểu tượng 💾 để lưu.

## 2. Tạo các tab và cấp quyền

1. Ở thanh công cụ phía trên, chọn hàm **caiDat** trong ô chọn hàm, rồi bấm **Chạy**.
2. Google hỏi quyền: bấm **Xem lại quyền**, chọn tài khoản của bạn. Nếu hiện "Google chưa xác minh ứng dụng này", bấm **Nâng cao → Đi tới ... (không an toàn)** rồi **Cho phép**. Đây là mã của chính bạn chạy trên Sheet của chính bạn.
3. Quay lại Sheet: sẽ có 6 tab mới là Lop, HocSinh, BaiHoc, CauHoi, LuotNop, TraLoi.

## 3. Triển khai thành Web App

1. Trong Apps Script bấm **Triển khai → Tuỳ chọn triển khai mới**.
2. Bấm bánh răng cạnh "Chọn loại", chọn **Ứng dụng web**.
3. Đặt:
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
4. Bấm **Triển khai**, rồi copy **URL ứng dụng web** (kết thúc bằng `/exec`).

## 4. Dán địa chỉ vào web

Mở file `public/config.js`, dán URL vào giữa hai dấu nháy:

```js
window.BGS_API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

Lưu lại rồi mở trang giáo viên. Góc trên sẽ hiện "Dữ liệu: Google Sheets" và hỏi mật khẩu giáo viên.
Để trống (`''`) thì web chạy ở chế độ demo, dữ liệu lưu trong trình duyệt.

## Dữ liệu nằm ở đâu trong Sheet

| Tab | Nội dung |
|---|---|
| LuotNop | Mỗi lượt nộp bài một dòng: ngày, giờ, lớp, học sinh, bài, lần thứ, điểm |
| TraLoi | Mỗi câu trả lời một dòng: ngày, học sinh, câu số mấy, đúng/sai, em đã trả lời gì |
| HocSinh, Lop | Danh sách lớp và mã học sinh |
| BaiHoc, CauHoi | Bài học và từng câu hỏi kèm đáp án |

Muốn xem theo ngày ngay trong Sheet: vào tab LuotNop, chọn **Dữ liệu → Tạo bộ lọc**, rồi lọc cột `ngay`.
Muốn tải về Excel: **Tệp → Tải xuống → Microsoft Excel (.xlsx)**, hoặc dùng nút "Xuất Excel" ở tab Báo cáo trên web.

## Lưu ý

- Mỗi lần sửa `Code.gs` phải triển khai lại: **Triển khai → Quản lý các tùy chọn triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai**. URL giữ nguyên.
- Đừng sửa tên tab hoặc dòng tiêu đề cột. Đừng sửa tay các cột `id`, `baiId`, `luotId`, `nopLuc`.
- Mỗi lần học sinh tải bài hoặc nộp bài mất khoảng 1-3 giây. Đó là tốc độ bình thường của Google Sheets.
- Để học sinh ở nhà mở được, thư mục web này còn phải được đưa lên mạng (Cloudflare Pages hoặc GitHub Pages).
