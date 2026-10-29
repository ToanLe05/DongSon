# Quy định thao tác khi chơi với bot

## Người chơi và agent

Người chơi chỉ chọn và đi quân thuộc `matchConfig.humanColor`. Giao diện lọc thao tác và cầu nối kiểm tra lại màu quân/lượt; `/legal_moves` không trả nước của bot cho giao diện điều khiển quân. Chế độ Hai người vẫn cho hai bên luân phiên trên cùng thiết bị.

Agent chỉ trả một `Move` hợp lệ hoặc `None`. Phong cấp là một phần của nước agent chọn, không mở hộp thoại cho người. Đề xuất kiểu lệnh như đề nghị hòa hoặc đầu hàng bị từ chối. Người chơi có thể đề nghị hòa hợp lệ; việc bot trả lời do cầu nối xử lý, không do agent chọn lệnh.

## Đầu hàng

Trong chế độ bot, Đầu hàng luôn tính cho bên người chơi đã chọn, kể cả khi giao diện đang hiện Bot đang nghĩ. Hộp xác nhận nêu đúng tên bên người chơi. Yêu cầu lấy phiên bản mới nhất từ bộ luật trước khi ghi nhận; nếu ván đã kết thúc thì giữ kết quả đó. Phản hồi bot cũ không được mở lại ván đã kết thúc.

Kết quả đầu hàng và cấu hình được lưu/khôi phục cả khi bên đến lượt trên bàn là bot. Với Hai người, đầu hàng vẫn tính cho bên đến lượt như trước.

## Lỗi chọn nước

Agent nhận bản sao độc lập của ván. Nếu agent sửa bản sao, ném ngoại lệ hoặc trả đề xuất không hợp lệ, bàn thật, lịch sử, lượt và revision không thay đổi. Lỗi có thông báo tiếng Việt và nút Thử lại lượt bot; không tự gửi lặp vô hạn. Người chơi cũng có thể đầu hàng hoặc tải ván khác.

Nước đã được bộ luật thực hiện và ghi thành công vẫn được khôi phục nếu phản hồi bị ngắt sau đó. Đây là trường hợp mất phản hồi của nước đã xác nhận, khác với lỗi trong quá trình chọn nước.

## Chơi lại

Khi ván kết thúc, màn chọn hiện lại với chế độ và bên đã chọn. Người chơi có thể giữ nguyên rồi bấm Chơi lại, hoặc đổi chế độ/bên trước khi bấm. Thủy luôn đi trước trong ván mới. Nếu giữ bên Sơn khi chơi với bot thì bot thực hiện đúng một nước mở đầu.

## Kiểm tra lại

```text
npm test
npm run test:bot
npm run test:bridge
npm run test:files
npm run build
npm run test:web:browser -- --trace=off
```

`tests/test_bot_policies.py` kiểm tra quyền thao tác, đầu hàng ở cả hai lượt, cấm lệnh từ agent, cách ly lỗi và các thế bắt quân kèm phong cấp. `tests/local-browser/bot-policy.spec.cjs` kiểm tra hai màu bot tự phong cấp, lỗi và thử lại, đầu hàng khi bot đang nghĩ và đổi chế độ khi chơi lại. Bộ giao diện còn kiểm tra Hai người, lưu/tải JSON, kết thúc, nhiều lượt và phản hồi đến muộn.
