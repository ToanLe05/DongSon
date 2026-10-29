# Điểm vào suy luận của bot

`src/bot_agent.py` cung cấp giao diện cố định:

```python
class BotAgent:
    def select_move(self, game):
        ...  # Trả về Move hoặc None; không thay đổi game.
```

Hiện agent gọi `game.legal_moves()` và chọn ngẫu nhiên một nước; không có nước hợp lệ thì trả `None`. Phong cấp và Hoán Quân dùng cùng cấu trúc `Move` do bộ luật cung cấp.

## Trách nhiệm

- `dongson_engine.py`: luật, danh sách nước hợp lệ và thực hiện nước đã kiểm tra.
- `bot_agent.py`: chọn một nước để đề xuất. Không gọi `make_move`, thay bàn, đổi lượt, sửa lịch sử hoặc lưu ván.
- `browser_bridge.py`: kiểm tra ván/lượt/gameId/revision; gọi agent; xác nhận kiểu kết quả và thực hiện bằng `game.make_move`. Kết quả `None`, sai kiểu hoặc nước không hợp lệ không làm tăng revision. Đề nghị hòa do cầu nối xử lý trước khi gọi agent.
- `MatchController.js`: điều phối lượt, khóa thao tác trong lượt bot và thông báo kết quả/lỗi; không chọn nước thay agent.

Cầu nối truyền **bản sao độc lập của ván** vào agent để bảo vệ ván thật nếu mã suy luận lỗi hoặc sửa dữ liệu. Ngoại lệ khi chọn nước trả lỗi `bot_error`; ván, lịch sử, lượt và revision giữ nguyên. Chỉ một đối tượng `Move` được bộ luật xác nhận mới có thể được thực hiện. Agent không có quyền trả lệnh đề nghị hòa hoặc đầu hàng. API Python cũ cũng cách ly ván khi gọi agent.

Worker đóng gói `bot_agent.py` bằng `?raw` cùng các tệp Python khác, ghi vào hệ thống tệp Pyodide trước khi nhập `browser_bridge`. Không tải riêng `.py` qua HTTP. API Python cũ cũng gọi cùng `BotAgent`.

## Yêu cầu bot đi trong trình duyệt

`GameSync.aiMove(level)` lấy `gameId` và `revision` của thế đang hiển thị, rồi chuyển qua `ApiClient.aiMove(level, context)`. Thân yêu cầu `/ai_move` chứa cả ba trường: `level`, `gameId`, `revision`. `LocalClient` chuyển lời gọi này đến Worker thay vì FastAPI.

Worker coi `/ai_move` là thao tác thay đổi ván: chụp trạng thái trước lệnh, thực hiện trong hàng đợi chung và chỉ trả thành công sau khi ghi checkpoint vào IndexedDB. Giao dịch so sánh bản lưu trước khi ghi để chặn yêu cầu từ phiên bản cũ; lỗi lưu hoàn tác thay đổi chưa ghi.

Cầu nối từ chối yêu cầu cũ, sai lượt, ván Hai người hoặc ván đã kết thúc trước khi chọn nước. Bot có thể trả lời đề nghị hòa hợp lệ của người chơi mà không đi thêm quân. Phía `GameSync` cũng chặn gọi bot sau khi kết thúc và dùng cùng khóa thao tác để không gửi hai yêu cầu đồng thời.

Kiểm tra đường truyền bằng `npm test`; kiểm tra bot/lưu trạng thái/khóa ván với Python thật trong trình duyệt bằng `npm run test:web:browser -- pending-config.spec.cjs --trace=off`.

## Thay bằng agent đã huấn luyện

Giữ phương thức `select_move(game)` khi đổi cách chọn nước. Mô hình/checkpoint cần là tài nguyên độc lập, được nạp khi khởi tạo; không nhúng trọng số hoặc mã huấn luyện vào tệp suy luận này. Vòng lặp huấn luyện, dữ liệu huấn luyện và đánh giá thuộc các module riêng. Khi có mô hình thật, bổ sung bộ nạp và đường dẫn tài nguyên phù hợp với Worker/GitHub Pages.

Bản hiện tại chưa có mô hình hoặc mã huấn luyện và chỉ hỗ trợ `botId: "random"`. Bản lưu giữ cấu hình và ván cờ, không tuần tự hóa đối tượng agent, mô hình hay trạng thái bộ sinh số ngẫu nhiên.

## Kiểm tra

`npm run test:bot` kiểm tra chọn nước hợp lệ mà không thay đổi ván, trả `None` ở thế không có nước, cầu nối từ chối đề xuất lỗi và không gọi agent ngoài lượt hoặc sau khi ván kết thúc. `npm run test:bridge` còn kiểm tra ba lựa chọn phong cấp và luồng bot trong bản lưu.
