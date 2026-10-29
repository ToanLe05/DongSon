# Mở Cờ Đông Sơn bằng file exe

## Chơi ngay

Nhấp đúp **CoDongSon.exe** ở thư mục gốc DongSon, chờ cửa sổ Cờ Đông Sơn hiện lên rồi bấm **Bắt đầu**. Không cần mở PowerShell, chạy máy chủ, cài Python hay npm để chơi.

Có thể chép **một mình file exe** sang Desktop hoặc một thư mục khác. Bản giống hệt cũng nằm tại `release/CoDongSon.exe`. Không cần chép kèm `src/`, `node_modules/`, `.venv/` hoặc thư mục ảnh.

- Đóng cửa sổ trò chơi để thoát; máy chủ luật đi kèm sẽ dừng.
- Nhấp đúp lần nữa khi đang mở sẽ đưa cửa sổ đang có lên trước, không khởi tạo thêm ván.
- Chọn Chơi lại trong trò chơi để bắt đầu ván mới.
- Tắt hẳn ứng dụng sẽ kết thúc trạng thái ván trong bộ nhớ, giống khi dừng máy chủ trước đây.

## Thông tin bản đóng gói

- Windows x64, tên file `CoDongSon.exe`, dung lượng 21.039.160 byte (khoảng 20,1 MiB).
- Đóng gói Python, máy chủ luật, giao diện và ảnh bằng PyInstaller 6.22.3; cửa sổ dùng pywebview 6.2.1. [Cách đóng gói của pywebview](https://pywebview.flowrl.com/guide/freezing.html).
- Cửa sổ riêng dùng WebView2 có sẵn trên máy. Nếu không khởi tạo được cửa sổ nhúng, chương trình có đường mở bằng trình duyệt mặc định và một cửa sổ nhỏ để đóng trò chơi. Không dùng trình duyệt Internet Explorer. [Điều kiện bộ dựng Windows](https://pywebview.flowrl.com/guide/web_engine.html).
- Chỉ lắng nghe trên máy hiện tại, tự chọn cổng còn trống; không chiếm cổng 8000 của bản phát triển.
- Ảnh và chữ dùng nguồn cục bộ/phông hệ thống, không tải Google Fonts khi mở ván.
- Bản này chưa ký số.

Dữ liệu riêng nằm tại `%LOCALAPPDATA%\DongSon\`: log `desktop.log`, bản lưu API trong `saves/` và bộ nhớ đệm cửa sổ. Vì vậy có thể để exe ở thư mục không ghi được mà không lưu vào vùng giải nén tạm. Ván hiện tại chưa có cơ chế tự lưu khi đóng.

## Kiểm tra ngày 29/10/2026

- Tạo môi trường đóng gói riêng, `pip check` không có lỗi phụ thuộc.
- Hai bài thử host: giao diện và API dùng cùng địa chỉ, bắt đầu/đi quân/đầu hàng/chơi lại hoạt động; dừng host giải phóng luồng và cổng.
- Chép exe sang thư mục có khoảng trắng, chỉ có một file, rồi mở trực tiếp. Log xác nhận đang chạy bản frozen và máy chủ tích hợp trả lời được.
- Trợ năng Windows đọc được cửa sổ trò chơi, trạng thái lượt và các nút. Đã đối chiếu ván đang chạy với nước Đinh f3 → f4 được ghi ở API; giữ nguyên ván đó.
- Mở exe lần hai thoát tự động, PID và địa chỉ máy chủ đầu tiên giữ nguyên.
- Công cụ chụp cửa sổ native trả về `window capture timed out`; việc kiểm tra cửa sổ ở lần này dùng trợ năng và trạng thái API, không có ảnh chụp native để đối chiếu.
- Chưa kiểm tra trên một bản Windows mới cài; máy hiện tại đã có WebView2 Runtime.
- 95 kiểm thử luật/API đã qua sau khi thêm cấu hình thư mục dữ liệu. Bài kiểm thử cửa sổ nhỏ, hòa và đầu hàng đã qua sau khi sửa canvas co giãn theo thanh nút. Vite bỏ qua bộ nhớ đệm và thư mục bản đóng gói khi theo dõi thay đổi, tránh vướng tệp trình duyệt đang được sử dụng.
- Kiểm tra cửa sổ native ở bản đóng gói trước lần sửa co giãn cuối; bản cuối dùng cùng host/cách đóng gói, với phần sửa giao diện được kiểm tra bằng Chromium.

SHA-256 bản giao:

```text
94AF6DAAD32D5AB4503AEAFAD0B4104282FD994F99FF1D221F798FECF58D1A82
```

## Dành cho việc tạo lại file exe

Người chơi không cần thực hiện phần này. Tại máy Windows x64 có Python 3.12 và Node 24/npm 11, cài các phiên bản đã khóa:

```powershell
python -m venv .venv-desktop
.\.venv-desktop\Scripts\python.exe -m pip install -r src/requirements-desktop.txt
npm.cmd ci
npm.cmd run build:exe
```

Lệnh tạo giao diện riêng ở `.desktop-build/web`, đóng gói bằng [CoDongSon.spec](../packaging/CoDongSon.spec), đặt kết quả ở `release/CoDongSon.exe` và chép ra `CoDongSon.exe` tại gốc. Không ghi đè bản web thường trong `dist/`. Các phụ thuộc bổ sung được khóa trong `src/constraints-desktop.txt`.

Kiểm thử host:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_desktop_host.py -q -p no:cacheprovider
```

Khi cần kiểm thử bản đóng gói với dữ liệu riêng, có thể đặt `DONGSON_DATA_DIR` cho tiến trình trước khi mở exe. Người chơi bình thường không cần đặt biến này.
