# Kiểm tra bản web hai người — 29/10/2026

**Báo cáo lịch sử của kiến trúc FastAPI.** Bản phát hành hiện tại đã chuyển sang Python trong Web Worker; xem [WEB.md](WEB.md). Các kết quả bên dưới không phải kết quả kiểm thử cầu nối mới.

Môi trường: Windows x64, Python 3.12.10, Node 24.18.0, Pixi 8.14.0, Chromium của Playwright 1.56.1. Máy chủ luật thật và bàn cờ Pixi thật, không thay bằng giao diện giả.

## Các lỗi đã xử lý

- Các trình duyệt từng dùng chung một ván toàn cục. `web:app` nay tách phiên theo cookie; mỗi ván có khóa, phiên bản và kết quả cuối riêng.
- Địa chỉ API mặc định từng trỏ vào máy của người truy cập. Bản web nay dùng `/api` cùng địa chỉ trang; máy chủ phục vụ cả giao diện và luật.
- Tải lại ngay sau Bắt đầu từng quay về màn hình chờ vì chưa có nước đi. Máy chủ nay giữ trường `started` và giao diện khôi phục theo trường này.
- Yêu cầu từ tab/đời ván cũ không thể đi quân, đầu hàng, trả lời hòa hoặc tạo lại ván đang diễn ra. Yêu cầu trùng chỉ được ghi nhận một lần.
- Resize từng làm dấu chọn/nước hợp lệ giữ kích thước cũ. Các dấu được vẽ lại theo ô mới.
- Lớp ô cờ từng che vòng tròn e5. Cung và ô Tâm được vẽ trên nền ô, không chặn thao tác chuột; tọa độ sáng và đủ lớn trên điện thoại.
- Vẽ lại nền từng tháo cả tọa độ ra khỏi lớp dùng chung và không giải phóng đồ họa cũ. Nền nay có vùng sở hữu riêng, giải phóng phần thay thế khi resize.
- Tab ẩn tạm dừng vẽ; tab hiện lại tiếp tục hoạt ảnh và cập nhật trạng thái nếu không có thao tác đang chờ.

## Kiểm thử

| Nhóm | Kết quả |
| --- | --- |
| Python: luật, các thế đúng/sai, API, web, tương thích máy chủ desktop | 105 đạt |
| JavaScript: hoạt ảnh, phong cấp, sự kiện, lỗi mạng, tài nguyên khi vẽ lại | 23 đạt |
| Giao diện ván thường và thế đặc biệt | 31 đạt, 0 lỗi, 0 bỏ qua |
| Bản đóng gói `dist/` + `web:app` | 3 đạt, 0 lỗi, 0 bỏ qua |
| Build Vite | Thành công |

31 luồng bao gồm ván chuẩn đến Tiến Cung, bắt quân/đầu hàng, chiếu và thoát chiếu, Tiến Cung cho cả hai màu, Sính lễ bị bắt được nên chưa thắng, hòa trơ Thần/bí nước/lặp thế/50 nước, Hoán Quân, đóng băng e5, khóa Cung, chọn đủ ba phong cấp cho hai màu, hủy phong cấp, bắt quân kèm phong cấp, lỗi thế cũ và chơi lại rồi đi tiếp. Chi tiết các thế trong [báo cáo giao diện](UI_TEST_REPORT.md) và [quy ước luật](../RULES.md).

Nhật ký chạy lại đầy đủ 31 luồng: `.test-artifacts/ui-results.json`. Không có lỗi JavaScript chưa xử lý trong 31 luồng. Sau sửa lớp vẽ Cung/tọa độ cuối cùng, chạy lại 23 kiểm thử JavaScript và bộ bản đóng gói; không chạy lại toàn bộ 31 luồng vốn đã qua trước thay đổi hiển thị này.

Ba luồng bản đóng gói xác nhận: bắt đầu/tải lại trước nước đầu/đề nghị và trả lời hòa/khóa ván/chơi lại; hai hồ sơ trình duyệt độc lập và yêu cầu từ tab cũ; điện thoại 390–430 px, mở/đóng Cách chơi, đổi kích thước khi đang chọn quân rồi đi tiếp. Không có lỗi JavaScript chưa xử lý. Nhật ký: `.test-artifacts/web-ui-results.json`; ảnh: `.test-artifacts/ui-screenshots/web-hotseat.png` và `web-mobile.png`.

Máy kiểm thử dùng WebGL phần mềm. Lần đầu bài nhiều tab chờ khởi tạo canvas 5 giây chưa đủ; tăng thời gian chờ khởi tạo lên 15 giây và đóng canvas của hồ sơ B sau khi đã xác nhận ván B, vẫn giữ cookie và đối chiếu ván B qua API trong suốt lượt A. Các phép kiểm tách phiên, từ chối yêu cầu cũ và đi tiếp được giữ nguyên.

## Giới hạn xác nhận

Các thế đặc biệt được nạp ở máy chủ thử riêng; bản web công khai không có đường dẫn nạp thế. Mốc 50 nước bắt đầu từ đồng hồ 99 rồi đi thêm một nước. Bộ kiểm thử không chứng minh mọi thế nhập tùy ý hoặc đo tải nhiều người dùng.

Phiên ở bộ nhớ, một worker/replica; hết hạn sau 24 giờ không hoạt động và mất khi máy chủ khởi động lại. Chưa triển khai lên tên miền công khai. Dockerfile đã chuẩn bị, nhưng Docker Engine trên máy kiểm thử chưa chạy nên chưa xác nhận build container. Hướng dẫn chạy/triển khai: [WEB.md](WEB.md).
