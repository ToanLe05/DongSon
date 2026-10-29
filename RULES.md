# Quy ước luật của dự án

Bản chốt ngày 28/10/2026, rà soát lại ngày 29/10/2026. Nguồn tham chiếu: [Luật chơi cơ bản Cờ Đông Sơn](https://codongson.vn/luat-choi-co-ban/). Các quy ước triển khai dưới đây là hợp đồng của dự án; không tuyên bố thay thế toàn bộ luật thi đấu chính thức.

Bản phát hành mặc định hiện chạy chính `dongson_engine.py` bằng Pyodide trong Web Worker. Quy tắc di chuyển/khống chế và kết quả bên dưới không đổi. Worker giữ kết quả cuối, kiểm tra gameId/revision và xử lý tuần tự; IndexedDB lưu trạng thái/lịch sử để tải lại cùng tab. Các mục nhắc đến API/máy chủ bên dưới mô tả phiên bản FastAPI được giữ để đối chiếu, không phải phụ thuộc khi chơi bản web tĩnh. Xem [docs/WEB.md](docs/WEB.md).

Bản trình duyệt có Lưu/Tải ván và Xuất/Nhập JSON. Tải hoặc nhập sau xác nhận tạo một đời ván mới, giữ lịch sử và kết quả của bản nạp; không mở khóa đời ván đã kết thúc. Bản kết thúc được nạp vào vẫn từ chối đi quân, hòa hoặc đầu hàng. Tệp sai định dạng hoặc dữ liệu không nhất quán bị từ chối trước khi thay ván.

## Phạm vi và khống chế

Bốn vùng góc được chốt cùng người dùng: a1–e5, e1–k5, a5–e9, e5–k9. Trước khi vào Cung, hai đầu mỗi nước Sính lễ phải cùng thuộc ít nhất một vùng này, không phụ thuộc màu. Không lấy hợp của cả bốn vùng rồi cho phép đi toàn bàn. Trong Cung d4–f6, chỉ được đi và khống chế bên trong. Việc nhảy ngang qua Cung không tính là đã vào; đáp xuống ô trong Cung mới khóa. Quân nhập thế đang trong Cung cũng bị khóa dù thiếu cờ trạng thái.

Cùng một hàm sinh hình học quyết định ô khống chế và nước đi của Sính lễ; Lạc/Thần dùng chung tia bị chặn. Ngựa nhảy L; Voi chéo 1–2 ô; Gà thẳng đúng 2 ô. Quân ở giữa không cản ba loại Sính lễ. Quân cùng bên tại đích được bảo vệ, nhưng không thể đi vào ô đó.

Bộ đi thẳng ô trống, khống chế/bắt chéo trước; Đinh đi và khống chế thẳng trước. Khống chế gồm cả ô trống và quân được bảo vệ. Quân ghim vẫn khống chế theo hình học; nước đi hợp lệ phải qua bước mô phỏng an toàn Thần. Vì vậy “ô bị khống chế” và “quân có thể bị bắt hợp lệ” là hai phép kiểm khác nhau có chủ đích. Thần không bị bắt khỏi bàn; ván kết thúc bằng chiếu hạ.

Ngựa, hoặc Gà phong cấp, đáp xuống e5 sẽ đóng băng: không đi và không khống chế. Voi và Gà thường không áp dụng ngoại lệ đóng băng này. Quy ước dự án: không lưu thêm cờ mất quyền Tiến Cung vĩnh viễn; quân đóng băng chặn e5 khi còn trên bàn, nếu bị đối phương bắt thì ô được giải phóng. Bộ/Đinh bắt buộc phong cấp ngay tại hàng cuối thành Voi/Gà/Ngựa; dùng ngay phạm vi vùng góc của ô hiện tại.

## Tiến Cung

Đánh giá cho bên vừa hoàn thành nước đi, trên bàn sau nước đi, với ba phép kiểm:

1. Thần ở e5, không nằm trong vùng khống chế đối phương.
2. Có ít nhất **một quân cụ thể** thuộc nhóm Sính lễ trong Cung mà đối phương không thể bắt bằng bất kỳ nước hợp lệ nào ngay sau đó. Có nhiều Sính lễ thì chỉ cần một quân đáp ứng. Bảo vệ Sính lễ không ngăn đối phương bắt bằng quân thường rồi chịu đổi quân; nước bắt đó vẫn làm quân ấy không an toàn.
3. Không có nước đáp trả hợp lệ nào chiếu hạ ngay Thần. Mô phỏng từng nước đáp trả, không chỉ xem bản đồ khống chế hiện tại.

Kết quả là thắng ngay khi ba phép kiểm đúng, không đợi người chơi thực hiện thêm lượt. Hai thế `tribute-mate-next` và `tribute-reply-not-mate` chỉ khác Ngựa Sơn c7, kiểm tra riêng điều kiện thứ ba.

## Hòa và kết thúc

Đây là các điều kiện được triển khai dứt khoát, không dùng điểm quân để đoán mọi thế không thể thắng.

| Điều kiện | Kết quả và cách kích hoạt |
| --- | --- |
| Một bên hoặc cả hai chỉ còn đúng một Thần | Tự động hòa thiếu quân; thay quy ước cũ chỉ hòa khi cả hai đều trơ Thần. Không suy diễn thêm các tổ hợp thiếu quân khác. |
| Đến lượt, không bị chiếu, không có nước hợp lệ | Tự động hòa bí nước; đây là quy ước dự án giữ lại, nguồn tham chiếu không nêu riêng trường hợp này. |
| Thế hiện tại xuất hiện lần thứ ba | Tự động hòa; không cần cùng chuỗi nước. |
| 100 nửa lượt liên tiếp không đi Bộ/Đinh và không bắt quân | Có quyền yêu cầu hòa 50 nước; **không tự động kết thúc**. Chỉ bên đang đến lượt được yêu cầu. Mốc 99 chưa đủ. |
| Hai bên đã thực hiện ít nhất một nước, một bên đề nghị và bên kia chấp nhận | Hòa thỏa thuận được lưu thành kết quả; không tự chấp nhận đề nghị. |

Khóa lặp thế gồm vị trí, màu, loại, trạng thái phong cấp/khóa Cung/đóng băng, bên đến lượt và quyền Hoán Quân. Không dùng ID quân hay số lượt. Sự thay đổi `has_moved` của quân không liên quan đến Hoán Quân không làm thành thế mới. Undo bỏ lần xuất hiện cuối, khôi phục đồng hồ và đề nghị trước nước đi. Save/load mới giữ lịch sử khóa lặp và trạng thái hòa; bản lưu cũ thiếu lịch sử chỉ bắt đầu đếm lại từ thế tải vào. Lịch sử nước đi cho undo/redo vẫn không được lưu.

Thứ tự xét kết quả khi đang chơi: Tiến Cung → chiếu hạ → bí nước → trơ Thần → yêu cầu hòa 50 nước đã được chấp nhận → lặp ba lần. Hòa thỏa thuận chỉ có thể được chấp nhận khi ván còn tiếp diễn và sau đó giữ nguyên kết quả. Nước đi mới bị từ chối khi ván đã kết thúc.

API `POST /draw` nhận:
- `{"action":"offer"}`: đề nghị, sau ít nhất hai nửa lượt.
- `{"action":"accept","color":"son"}`: bên Sơn trả lời đề nghị của Thủy (và ngược lại).
- `{"action":"claim_fifty"}`: yêu cầu khi đủ 100 nửa lượt.

Phản hồi chứa `accepted`, `pending`, `state`. Trạng thái bàn có `drawOfferPending`, `canOfferDraw` và `canClaimFiftyMoveDraw`. Đây là PvP cục bộ: màu trả lời là thông tin người gọi cung cấp, chưa phải xác thực người chơi qua mạng.

Giao diện có nút Đề nghị hòa sau khi mỗi bên đã đi ít nhất một nước. Khi có đề nghị, bên còn lại chọn Đồng ý hòa hoặc Tiếp tục chơi; bàn cờ tạm khóa chờ trả lời. Tiếp tục chơi gửi `{"action":"decline","color":"son"}` (hoặc `thuy`), không đổi lượt. Nút Yêu cầu hòa 50 nước chỉ xuất hiện khi đủ điều kiện. Đầu hàng có bước xác nhận ghi rõ bên đầu hàng. Mỗi kết quả kết thúc được thông báo bằng tiếng Việt cùng lý do cụ thể.

Máy chủ giữ bản chụp kết quả cuối ván và khóa các yêu cầu sửa ván: đi quân, AI, hoàn tác, đi lại, hòa, đầu hàng, tải ván và đổi cấu hình. Vẫn được xem trạng thái, lưu kết quả và xem replay. Chỉ `/new_game` tạo ván mới; nếu muốn tải bản lưu sau một ván đã kết thúc thì phải bắt đầu ván mới trước.

Bản web `web:app` tách trạng thái và khóa theo cookie trình duyệt; API phát triển/desktop vẫn có ván mặc định riêng. Bản web bắt buộc `gameId`/`revision`, còn API cũ nhận thiếu hai trường để tương thích. Xem [docs/WEB.md](docs/WEB.md).

Tất cả thao tác API đọc/sửa một ván dùng cùng một khóa trong tiến trình; chạy máy chủ cục bộ với **một worker**. Phản hồi có `gameId` và `revision`; giao diện gửi lại hai giá trị này với nước đi, hòa và đầu hàng. Yêu cầu từ thế/đời ván cũ bị từ chối bằng 409 kèm trạng thái hiện tại. API vẫn nhận yêu cầu không có hai trường này để tương thích công cụ cũ, nhưng khóa kết thúc ván luôn áp dụng. Cơ chế này chưa phải lưu trữ dùng chung cho nhiều tiến trình/máy chủ.

## Các thế đúng–sai chạy được

Dữ liệu: [tests/rule_positions.json](tests/rule_positions.json). Trừ ô được thay/xóa trong từng thế, nền gồm Thần Thủy a1, Đinh Thủy k2, Thần Sơn k8, Đinh Sơn a8. Như vậy các thế thử khác không vô tình kết thúc vì một bên trơ Thần. Mỗi thế ghi rõ bên đến lượt, thay đổi quân và kỳ vọng; tất cả được nạp trực tiếp bởi kiểm thử.

| Mã thế | Điều cần phân biệt |
| --- | --- |
| `than-shape` | Thần e2 đi chéo f3; không đi kiểu Ngựa g3. |
| `lac-ray` | Lạc c2 đi thẳng c7; không đi chéo d3. |
| `lac-block` | Lạc c2 bị quân cùng bên c4 chặn, vẫn bảo vệ c4. |
| `bo-empty` | Bộ c3 đi thẳng c4; khống chế d4 trống nhưng không đi đến đó. |
| `bo-capture` | Bộ c3 bắt chéo d4, không bắt thẳng c4. |
| `dinh-forward` | Đinh d2 đi và khống chế d3, không đi chéo e3. |
| `dinh-defend` | Đinh d2 bảo vệ quân cùng bên d3 nhưng không đi vào ô đó. |
| `ngua-jump` | Ngựa b2 nhảy đến d3 dù c2 bị chặn. |
| `ngua-zone-no` | Ngựa b4 không đi/khống chế c6: hai ô không chung vùng góc. |
| `upper-zone-thuy` | Ngựa thuy a7 đi b9 trong vùng góc trên, không phụ thuộc màu. |
| `upper-zone-son` | Ngựa son a7 đi b9 trong vùng góc trên, không phụ thuộc màu. |
| `voi-jump` | Voi c3 nhảy qua d4 đến e5; không đi 3 ô đến f6. |
| `voi-zone-no` | Voi c4 không đi/khống chế e6 dù e6 trong Cung: hai đầu không chung vùng góc. |
| `ga-jump` | Gà c3 nhảy qua c4 đến c5, không đi một ô c4. |
| `ga-zone-boundary` | Gà e3 đi g3 (chung góc phải); Gà d3 không đi f3. |
| `palace-implicit-lock` | Voi d4 chỉ đi/khống chế trong Cung kể cả cờ nhập thiếu entered_palace. |
| `palace-capture-no` | Voi d4 không bắt Bộ c3 ngoài Cung. |
| `frozen-no-control` | Ngựa đã đóng băng tại e5 không đi/khống chế d3. |
| `tribute-safe` | Thần e5 + Voi d4 an toàn: đủ Tiến Cung. |
| `tribute-no-gift` | Thần e5 nhưng không có Sính lễ: chưa Tiến Cung. |
| `tribute-outside` | Voi c3 ngoài Cung không tính là Sính lễ Tiến Cung. |
| `tribute-center-attacked` | Lạc Sơn e9 khống chế e5: không Tiến Cung. |
| `tribute-gift-capturable` | Lạc Sơn d8 bắt được Voi d4: không Tiến Cung. |
| `tribute-one-safe` | Voi d4 bị Lạc d8 đe dọa, Voi f4 an toàn: đủ một Sính lễ. |
| `tribute-all-capturable` | Cả Voi d4 và f4 đều bắt được: không Tiến Cung. |
| `tribute-pinned-attacker` | Lạc Sơn a4 bị ghim vào Thần a8 bởi Lạc Thủy a2; bắt Voi d4 là bất hợp lệ. |
| `bare-one` | Thủy chỉ còn Thần a1: hòa dù Sơn còn quân. |
| `bare-both` | Hai bên đều chỉ còn Thần: hòa. |
| `material-remains` | Hai bên còn Đinh: không suy diễn hòa thiếu quân. |
| `tribute-mate-next` | Thần e5 bị quân mình vây; Đinh Sơn e7-e6 được Ngựa c7 bảo vệ sẽ chiếu hạ. Voi d4 an toàn vẫn chưa đủ Tiến Cung. |
| `tribute-reply-not-mate` | Cùng thế trên nhưng bỏ Ngựa c7: Thần bắt được Đinh e6 để thoát chiếu; Tiến Cung hợp lệ. |
| `stalemate` | Thần a1 bị khóa bởi Gà Sơn a2,b1 và Ngựa b2; Ngựa c3 bảo vệ a2,b1, Voi c1 bảo vệ b2. Không bị chiếu, không có nước hợp lệ: hòa bí nước. |
| `stalemate-escape` | Bỏ Voi c1 ở thế bí nước: Thần a1 bắt được Ngựa b2 nên không còn bí nước. |

Các kiểm thử theo chuỗi còn kiểm tra: phong cấp cả Bộ/Đinh; vào Cung và undo; ngưỡng 99/100; ba sự kiện xóa đồng hồ; đề nghị/chấp nhận/undo; một chu kỳ thật tạo lần lặp thứ hai rồi thứ ba; thay đổi quyền Hoán Quân; một thế cùng quân khác lượt; JSON save/load; từ chối đi tiếp sau khi kết thúc. Với Sính lễ, bộ kiểm thử quét cả 81 ô xuất phát cho hai màu và ba loại, đối chiếu ô trống/quân địch/quân cùng bên.

Tạo môi trường Python và cài các phiên bản đã khóa theo [readme.md](readme.md). Chạy luật/API bằng `npm run test:api` để dùng đúng Python trong `.venv`; kiểm thử JavaScript bằng `npm test`. Kiểm thử trình duyệt: `npm run test:browser:install` rồi `npm run test:browser`.

