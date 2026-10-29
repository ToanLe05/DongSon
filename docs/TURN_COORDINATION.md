# Điều phối lượt người và bot

Sau Bắt đầu, mỗi thay đổi trạng thái hoặc khôi phục ván, `MatchController` kiểm tra cấu hình của ván, bên đến lượt và kết quả cuối:

- Ván Hai người hoặc lượt người: bật thao tác trên bàn.
- Lượt bot: khóa bàn, hiện **Bot đang nghĩ…**, xếp đúng một yêu cầu bot.
- Ván kết thúc: khóa bàn, không xếp thêm yêu cầu bot.
- Bot lỗi ở ván hiện tại: giữ trạng thái đã xác nhận và hiện nút Thử lại lượt bot; không tự lặp yêu cầu liên tục.

Thủy luôn đi trước. Khi người chơi cầm Sơn, bot tự đi nước đầu. Đề nghị hòa của người chơi được bot trả lời qua cùng bộ điều phối, không đi thêm quân khi đồng ý hòa.

Trong chế độ bot, cả giao diện và cầu nối chặn điều khiển quân đối phương. Phong cấp là phần nước đi agent chọn, không mở hộp thoại hỏi người. Đầu hàng áp dụng cho bên người chơi đã chọn, kể cả khi bot đang nghĩ; phản hồi bot đến sau đó không được mở lại ván đã kết thúc. Chơi lại giữ lựa chọn cũ và cho đổi chế độ/bên trước khi bắt đầu ván mới.

## Một yêu cầu bot tại một thời điểm

`MatchController` giữ một lịch gọi và một tác vụ bot đang chờ. `GameSync` giữ riêng yêu cầu bot chưa kết thúc, ngoài khóa thao tác thông thường. Do đó tải ván khác không làm mất dấu yêu cầu cũ và không cho gửi chồng một yêu cầu bot mới. Khi yêu cầu cũ kết thúc, bộ điều phối kiểm tra lại ván đang hiển thị trước khi đi tiếp.

## Tải ván khi bot đang nghĩ

Tải ván và Nhập JSON vẫn dùng được trong lượt bot. Người chơi xem trước và xác nhận như trước; hủy xác nhận giữ ván đang chơi. Worker xử lý các lệnh trong cùng hàng đợi, nên việc tải/nhập không ngắt một phép tính Python đang thực hiện.

Khi xác nhận thay ván, `GameSync` tăng phiên điều phối và tạo thao tác có chủ sở hữu mới. Nếu có yêu cầu cũ đang chờ, nó lấy `gameId`/`revision` mới nhất từ bộ luật trước khi nhập: bot có thể đã ghi nước đi nhưng phản hồi chưa tới giao diện.

Mỗi phản hồi chỉ được áp dụng nếu còn thuộc thao tác và phiên đã phát lệnh, đồng thời trạng thái gốc chưa bị thay. Kiểm tra này diễn ra trước và sau hoạt ảnh. Phản hồi/lỗi của ván cũ không sửa bàn, thông báo hay khóa bận của thao tác mới. Hoạt ảnh cũ được hủy khi bàn mới được đặt lại.

Nếu ván mới đang đến lượt người thì có thể thao tác ngay khi tải xong. Nếu ván mới đến lượt bot và yêu cầu cũ còn chờ, bộ điều phối đợi yêu cầu đó kết thúc rồi gửi một yêu cầu cho ván mới. `gameId`/`revision` và giao dịch lưu trong Worker tiếp tục kiểm tra ở phía bộ luật.

## Kiểm tra

`npm test` có các ca trì hoãn phản hồi/hoạt ảnh và lỗi có chủ đích: chỉ một yêu cầu, tự chạy sau bắt đầu/nước người/khôi phục, thay ván trước khi bot được gọi, bỏ qua kết quả và lỗi cũ, không mở khóa nhầm thao tác tải ván và thử lại sau lỗi.

```text
npm run test:web:browser -- bot-race.spec.cjs setup.spec.cjs --trace=off
```

Ca trình duyệt giữ lại phản hồi của một nước bot đã được Python thực hiện, nhập ván Hai người và đi được nước trên bàn mới, rồi nhập một ván bot khác trước khi trả phản hồi cũ. Nó kiểm tra chỉ một yêu cầu bot đang chờ, trả đúng lượt cho người chơi và tiếp tục đi nước của ván mới. Các ca setup kiểm tra luân phiên hai người, cả hai bên cầm quân, hòa, khôi phục, chơi lại và màn hình điện thoại.
