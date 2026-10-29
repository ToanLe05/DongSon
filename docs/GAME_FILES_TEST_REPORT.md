# Lưu/tải ván và tệp JSON — 29/10/2026

Lưu/Tải ván dùng IndexedDB phía trình duyệt. Xuất JSON tạo tệp tải về bằng Blob; Nhập JSON chỉ đọc tệp người chơi chọn. Cả bốn thao tác đi qua cầu nối Worker, không gọi FastAPI hoặc tải ván lên mạng.

## Dữ liệu và bảo toàn ván

Định dạng `dongson-game`, phiên bản 1, chứa bàn và ID quân, màu đến lượt, trạng thái phong cấp/khóa Cung/đóng băng, quyền Hoán Quân, lịch sử nước đi/thế lặp, đồng hồ, đề nghị hòa và kết quả cuối. Nhập tạo gameId mới để từ chối lệnh thuộc đời ván trước.

Worker kiểm tra dữ liệu trước khi thay ván: phiên bản, kiểu và kích thước dữ liệu, bàn 9×9, hai Thần, ID quân, cờ trạng thái, chuyển tiếp các bàn lịch sử, đồng hồ và thế hiện tại. Giới hạn tệp 16 MB. Không dùng pickle hoặc thực thi mã từ tệp. Kiểm tra bản lưu không phải chứng thực lịch sử thi đấu chống gian lận.

Tải/nhập hiện bản xem trước rồi hỏi xác nhận. Hủy hoặc tệp lỗi giữ nguyên ván. Nếu IndexedDB không ghi được, hoàn tác thay đổi chưa ghi và trả lại ván đã xác nhận trước đó. File chọn trong lúc trình duyệt đang đồng bộ khi trở lại từ hộp chọn tệp sẽ chờ thao tác đó hoàn tất.

## Kết quả

| Nhóm | Kết quả |
| --- | --- |
| Kiểm tra JSON dưới Python: chuyển ván, phong cấp, Hoán Quân, hòa, tệp hỏng | 27 đạt |
| Tổng luật/API đối chiếu/cầu nối/JSON dưới Python | 142 đạt |
| JavaScript và vòng đời RPC | 31 đạt |
| Luồng giao diện riêng cho lưu/tải JSON | 6 luồng phân biệt đạt |
| Điện thoại với các nút mới, chọn quân/resize/đi tiếp | Đạt |
| Build Vite | Thành công |

Các luồng giao diện dùng bản dist trên hosting tĩnh tại `/dongson/`, với mọi yêu cầu FastAPI và tên miền ngoài bị chặn:

1. Tải tệp JSON thật, hủy nhập, xác nhận nhập, tải lại, chọn lại cùng tệp và đi tiếp.
2. Lưu/tải trạng thái chờ hòa, đồng ý hòa, giữ kết quả cuối qua khóa tab mới, nạp ván đã kết thúc và Chơi lại.
3. Từ chối JSON hỏng, sai phiên bản, thiếu Thần và tệp quá lớn; giữ nguyên ván kể cả sau đầu hàng, không khởi động lại Worker vì lỗi tệp.
4. Xuất/nhập quân đã phong cấp, giữ ID/loại và tiếp tục ván.
5. Nhập khi có đồng bộ trạng thái đang chờ sau khi quay về từ hộp chọn tệp.
6. Đối chiếu save/load cục bộ theo ô lưu và mô phỏng hủy giao dịch IndexedDB lúc nhập; ván trước vẫn nguyên sau tải lại và đi tiếp.

Nhật ký theo giai đoạn: `.test-artifacts/game-files-full-results.json`, `game-files-final-results.json`, `game-files-atomic-results.json`, `game-files-error-check-results.json`; bản tổng hợp không đếm trùng `game-files-summary.json` có 6 luồng JSON và 1 luồng điện thoại đạt. Ảnh: `.test-artifacts/ui-screenshots/json-import-continued.png` và `local-worker-mobile.png`. Máy thử: Windows x64, Chromium/Playwright 1.56.1, Pyodide 0.29.5/Python WASM 3.13.2.

Sau lần chỉnh trạng thái chờ cuối cùng, đã build lại và chạy lại hai nhánh tệp lỗi/hộp chọn tệp: cả hai đạt. Không phát sinh yêu cầu FastAPI/CDN hoặc lỗi JavaScript chưa xử lý trên giao diện trong các bài đạt.

Không chạy lại toàn bộ các luồng Worker của đợt trước; các kiểm tra bổ sung tập trung vào lưu/tải, nhập/xuất, tính nguyên vẹn và bố cục sau thay đổi. Hướng dẫn người chơi: [WEB.md](WEB.md#lưu-và-khôi-phục-ván).
