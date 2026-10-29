# Cấu hình điều khiển ván cờ

`BrowserSession.match_config` giữ cấu hình của ván. Giao diện gửi các trường này khi bắt đầu, rồi đọc lại từ `state.matchConfig`; lựa chọn trên màn hình không ghi đè cấu hình của ván được tải.

Chơi với bot:

```json
{
  "mode": "human_vs_bot",
  "humanColor": "thuy",
  "botId": "random"
}
```

`humanColor` là `thuy` hoặc `son`. Bot điều khiển bên còn lại. Thủy luôn đi trước: nếu người chơi cầm Sơn, bot thực hiện nước đầu. Bot hiện được hỗ trợ là `random`, chọn ngẫu nhiên nước hợp lệ trong Worker.

Hai người:

```json
{
  "mode": "human_vs_human",
  "humanColor": null,
  "botId": null
}
```

Cả hai bên do người chơi điều khiển. Truyền chỉ `mode: "human_vs_human"` cũng được chuẩn hóa thành cấu hình trên.

## Lưu và khôi phục

- Trạng thái trả về có `matchConfig`, gồm cả trạng thái ván đã kết thúc.
- Checkpoint có `matchConfig`; tự động lưu IndexedDB giữ nguyên checkpoint này.
- Tệp JSON phiên bản 1 chứa cấu hình tại `snapshot.matchConfig`; Lưu ván dùng cùng bản xuất JSON.
- Tải lại trang, Tải ván và Nhập JSON đều khôi phục cấu hình từ `BrowserSession.restore`. Giao diện cập nhật thông tin người/bot và chỉ cho người chơi thao tác bên mình. Nếu đến lượt bot ở bản nạp, bot tiếp tục từ thế đó.
- Hộp xác nhận nhập/tải hiển thị ai cầm mỗi bên. Hủy xác nhận giữ nguyên ván hiện tại.

## Tương thích và kiểm tra dữ liệu

Bản lưu thiếu `matchConfig` mặc định là Hai người. Cấu hình cũ `{"mode":"pvp","humanSide":"thuy"}` chuyển thành `human_vs_human`; `{"mode":"bot","humanSide":"son"}` chuyển thành `human_vs_bot`, `humanColor: "son"`, `botId: "random"`. Sau khi xuất lại, chỉ ghi tên trường và giá trị mới.

Chế độ, màu hoặc `botId` không hỗ trợ bị từ chối. Cấu hình Hai người có chỉ định bot/màu người cũng bị từ chối để tránh dữ liệu mâu thuẫn. Tệp lỗi không thay ván hiện tại. Cấu trúc ván và lịch sử tiếp tục được kiểm tra như trước.

Kiểm tra bằng `npm run test:bridge`, `npm run test:files` và `npm run test:web:browser -- config-persistence.spec.cjs`. Ca giao diện thực hiện xuất/nhập tệp thật, tải lại trang, tiếp tục một lượt người và bot, rồi khôi phục bản Lưu ván từ một phiên mới cho cả hai lựa chọn bên.
