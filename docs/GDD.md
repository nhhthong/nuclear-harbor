# LAST STAND: NUCLEAR HARBOR

## Game Design Document (GDD)

**Phiên bản:** 1.2\
**Thể loại:** First-Person Shooter (FPS), Action, Objective-based
Survival\
**Nền tảng mục tiêu:** Web Browser\
**Engine:** Three.js + TypeScript\
**Chế độ:** Single-player, offline\
**Bối cảnh:** Bến cảng container công nghiệp\
**Phong cách:** Realistic Sci-Fi\
**Trạng thái tài liệu:** Đặc tả thiết kế nền tảng; thông số gameplay là
giá trị khởi điểm cần playtest.

### Changelog

**v1.2 (so với v1.1)**

-   Thu gọn bản đồ từ 6 zone xuống 4 zone. Cargo Ship thành vật trang trí
    tĩnh; Control Center gộp vào Dock.
-   Thêm quy tắc mật độ điểm móc; tăng số crane (5--6) và container
    (sinh theo lưới, dùng `InstancedMesh`).
-   Thêm robot khiên **Charger** (6 con, lao thẳng như tê giác). Tổng
    robot thường giữ ở 30: 14 cầu, 10 nhện, 6 Charger.
-   Thêm thông số người chơi (đề xuất), hệ thống pickup đạn/máu và bảng
    cân bằng đạn.
-   Giảm HP lõi TITAN-04 từ 10,000 xuống 4,000 (đề xuất, cần playtest).
-   Thêm vertical slice, danh sách cắt giảm phạm vi và đánh dấu đòn Boss
    bắt buộc/tùy chọn.
-   Zone streaming chuyển thành tùy chọn, quyết định sau benchmark.

------------------------------------------------------------------------

## 1. High Concept

Người chơi là người sống sót duy nhất tại một bến cảng container bị hệ
thống robot quân sự chiếm quyền điều khiển. Hệ thống kiểm soát hạt nhân
đang đếm ngược. Bốn trụ điều khiển khẩn cấp được giấu trong các khu vực
khác nhau của cảng.

Người chơi phải chiến đấu với robot hình cầu, robot nhện và robot khiên
lao như tê giác, khám phá bến cảng, kích hoạt cả bốn trụ, sau đó đối đầu
với một cỗ máy chiến tranh khổng lồ mang tên **TITAN-04**. Bốn đèn đỏ
quanh thân Boss là các điểm yếu bắt buộc phải phá hủy trước khi có thể
bắn vào lõi trung tâm.

**Mục tiêu trải nghiệm:** Kết hợp khám phá không gian 3D rộng, chiến đấu
FPS, di chuyển bằng grappling hook và một trận Boss nhiều giai đoạn.

## 2. Design Pillars

1.  **Readable FPS combat:** Bắn súng phản hồi rõ ràng, hit marker, âm
    thanh và hiệu ứng trúng đạn dễ nhận biết.
2.  **Traversal matters:** Grappling hook tạo tuyến di chuyển dọc và
    giúp tiếp cận các vị trí cao. Bản đồ được thiết kế quanh điểm móc.
3.  **Explore under pressure:** Người chơi phải tìm bốn trụ trong khi
    robot tuần tra và truy đuổi.
4.  **A memorable boss:** TITAN-04 có quy mô áp đảo, bốn điểm yếu có thể
    nhận diện rõ.
5.  **Performance by design:** Pooling, instancing, LOD và quản lý vòng
    đời GPU là yêu cầu kiến trúc ngay từ đầu. Streaming áp dụng khi
    benchmark cho thấy cần thiết.

## 3. Core Gameplay Loop

``` text
Bắt đầu
  -> Khám phá bến cảng
  -> Phát hiện / né tránh / tiêu diệt robot
  -> Tìm trụ điều khiển
  -> Kích hoạt và bảo vệ trụ
  -> Lặp lại cho đến khi đủ 4 trụ
  -> Dừng nguy cơ phóng hạt nhân
  -> TITAN-04 xuất hiện
  -> Phá hủy 4 điểm yếu màu đỏ
  -> Bắn lõi trung tâm
  -> Victory
```

## 4. Player Controls

  Input            Hành động
  ---------------- ---------------------------
  W / A / S / D    Di chuyển
  Mouse movement   Xoay camera
  Chuột trái       Bắn
  Chuột phải       Nạp đạn
  Space            Bắn grappling hook
  Shift            Chạy nhanh
  E                Tương tác / kích hoạt trụ
  Esc              Pause

Lưu ý: chuột phải là nạp đạn trái với thông lệ FPS (thường là ngắm).
Xem mục 17 về việc đổi sang phím R.

### 4.1 Grappling Hook

-   Khi nhấn Space, bắn móc theo hướng camera.
-   Raycast tìm bề mặt có tag `grappleable`. Raycast chỉ kiểm tra danh
    sách mesh/collider có tag này, không quét toàn bộ scene.
-   Nếu trúng điểm hợp lệ, hiển thị dây cáp và kéo người chơi về phía
    điểm móc.
-   Nhấn Space lần nữa hoặc đến gần điểm móc thì nhả dây.
-   Điểm móc hợp lệ gồm kết cấu crane, dầm thép, đỉnh container (tầng
    trên cùng), cột đèn và điểm neo được đặt thủ công.
-   Không móc vào robot, mặt nước hoặc vật thể không được đánh dấu.
-   Dùng capsule/character controller và kiểm tra va chạm trong lúc kéo;
    không cho phép xuyên địa hình.
-   Cáp cần có giới hạn tầm bắn, thời gian hồi và trạng thái thất bại
    khi không tìm thấy điểm neo.

| Thuộc tính | Giá trị khởi điểm |
|---|---|
| Tầm bắn tối đa | 40 m |
| Tốc độ kéo | 18 m/s |
| Thời gian hồi | 1.0 s |

### 4.2 Player Stats (đề xuất, cần playtest)

| Thuộc tính | Giá trị khởi điểm |
|---|---|
| HP | 100 |
| Tốc độ đi | 5 m/s |
| Tốc độ chạy (Shift) | 7.5 m/s |
| Nhảy | Không có (Space dành cho grapple), xem mục 17 |
| Hồi máu tự động | Không; chỉ bằng medkit |
| Khi HP = 0 | Game Over hoặc về checkpoint gần nhất (chốt ở mục 17) |

## 5. Weapon System and GameBanana Asset

### 5.1 Primary Weapon

Vũ khí mặc định là súng trường tự động góc nhìn thứ nhất. GDD sử dụng
mod GameBanana được người dùng cung cấp làm **nguồn asset tham chiếu /
ứng viên cho view model**:

-   **Asset:** DesertTech MDR Helix Prototype (theo thông tin mô tả đã
    được nêu trong cuộc trò chuyện; cần xác minh lại tên và nội dung
    trong gói tải).
-   **Nguồn GameBanana:** https://gamebanana.com/mods/225079
-   **File download được người dùng chỉ định:**
    https://gamebanana.com/mods/download/225079#FileInfo_391959
-   **Game gốc:** Counter-Strike 1.6 / GoldSrc.
-   **Vai trò dự kiến:** Tham chiếu hoặc nguồn model súng góc nhìn thứ
    nhất; không mặc định đây là asset GLB sẵn dùng cho Three.js.

**Lưu ý kỹ thuật và bản quyền:** Trong cuộc trò chuyện hiện có liên kết
GameBanana, chưa có file ZIP/MDL thực tế được tải lên để kiểm tra. Trước
khi tích hợp, cần tải gói mod, kiểm tra file bên trong, readme, tác giả,
điều khoản sử dụng và quyền chỉnh sửa/phân phối. Không đưa asset vào bản
phát hành công khai hoặc thương mại nếu chưa xác nhận giấy phép/được tác
giả cho phép.

**Phương án dự phòng (bắt buộc có):** Dùng model placeholder tự tạo hoặc
asset CC0/giấy phép cho phép. Mod CS 1.6 thường có nguồn gốc asset không
rõ; chỉ giữ nếu tác giả cho phép bằng văn bản. Phong cách model thời
GoldSrc (poly thấp) cũng có thể lệch với định hướng Realistic Sci-Fi.

### 5.2 Asset Conversion Pipeline

``` text
GameBanana archive
  -> Extract and inspect
  -> Identify v_ / p_ / w_ model files and textures
  -> GoldSrc-compatible importer / intermediate format
  -> Blender (headless)
  -> Validate mesh, UV, materials, rig and animations
  -> Export GLB
  -> Three.js GLTFLoader
```

-   `v_*.mdl`: view model, thường chứa súng và tay người chơi.
-   `p_*.mdl`: world/player model hiển thị trên nhân vật khác.
-   `w_*.mdl`: world model khi súng nằm trong thế giới.
-   Tên file và cấu trúc thực tế phải được xác nhận từ archive; không
    giả định mod này chắc chắn chứa đủ cả ba loại.
-   Blender không import GoldSrc MDL mặc định. Phải dùng importer tương
    thích GoldSrc hoặc chuyển qua định dạng trung gian.
-   Kiểm tra riêng animation, skeleton, texture, UV và material sau khi
    chuyển đổi. Không cam kết animation gốc sẽ được giữ nguyên nếu
    importer không hỗ trợ.

### 5.3 Starting Weapon Tuning

  Thuộc tính              Giá trị khởi điểm
  --------------------- -------------------
  Magazine                               30
  Reserve ammo                          180
  Damage                                 25
  Fire rate                    8 rounds/sec
  Reload duration                   1.8 sec
  Critical multiplier                  2.0x
  Fire mode                       Automatic

Các giá trị là tuning ban đầu, cần điều chỉnh qua playtest. Súng cần có
muzzle flash, recoil, hit marker, âm thanh bắn/nạp đạn, vỏ đạn và
animation phù hợp. Nếu asset GameBanana không có animation tương thích,
tạo animation view model riêng hoặc dùng model thay thế có giấy phép phù
hợp.

### 5.4 Ammo and Health Economy

Lượng đạn khởi đầu (210 viên) không đủ cho toàn bộ trận. Bảng ước tính
số phát trúng cần thiết (damage 25/phát, chưa tính crit và bắn trượt):

| Mục tiêu | Tổng HP | Số phát trúng |
|---|---|---|
| 14 robot cầu (100 HP) | 1,400 | 56 |
| 10 robot nhện (150 HP) | 1,500 | 60 |
| 6 Charger (200 HP) | 1,200 | 48 |
| 4 điểm yếu Boss (500 HP) | 2,000 | 80 |
| Lõi Boss | 4,000 | 160 |
| **Tổng** | **10,100** | **≈404** |

Với độ chính xác giả định 50%, cần khoảng 800 viên. Vì vậy:

-   **Ammo crate:** +30 viên mỗi crate. Mục tiêu khoảng 14 crate rải
    trong 4 zone (≈420 viên) và 8 crate tiếp tế trong khu đấu Boss
    (≈240 viên).
-   **Medkit:** +40 HP, khoảng 10 cái rải trong 4 zone, thêm 2--3 cái
    trong khu Boss.
-   Robot có thể rơi đạn với xác suất thấp (đề xuất 15%, giới hạn bởi
    ngân sách đạn mỗi zone).
-   Pickup đặt gần khu có Charger và gần các trụ; đặt ở vị trí cần
    grapple để thưởng cho khám phá.
-   Phát bắn trúng giáp trước của Charger bị giảm 90%, không tính vào
    ngân sách trên; người chơi được khuyến khích đánh từ hông/lưng.
-   Bảng trên chỉ là điểm xuất phát; cân bằng lại sau playtest.

## 6. Enemy Design

Tổng số robot thông thường được thiết kế trong màn chơi: **30**, gồm
**14 robot hình cầu, 10 robot nhện và 6 robot khiên Charger**. Đây là số
lượng gameplay; không bắt buộc tất cả phải được render ở mức chi tiết
cao cùng lúc.

### 6.1 Spherical Robots --- 14

-   Thân cầu kim loại, giáp phân mảnh, cảm biến đỏ và vũ khí tích hợp.
-   Di chuyển bằng lăn hoặc hệ thống đẩy.
-   Hành vi: patrol, detect, chase, attack, retreat (nếu được thiết kế),
    destroyed.

  Thuộc tính          Giá trị khởi điểm
  ----------------- -------------------
  Số lượng                           14
  HP                                100
  Damage                              8
  Speed                         3.5 m/s
  Attack range                     20 m
  Detection range                  25 m

### 6.2 Spider Robots --- 10

-   Thân máy trung tâm với bốn hoặc sáu chân cơ khí.
-   Chuyển động chân theo chu kỳ; có thể nhảy qua vật cản thấp tại các
    vị trí được hỗ trợ.
-   Hành vi: patrol, flank, chase, close-range attack, destroyed.

  Thuộc tính          Giá trị khởi điểm
  ----------------- -------------------
  Số lượng                           10
  HP                                150
  Damage                             12
  Speed                           5 m/s
  Attack range                     12 m
  Detection range                  30 m

### 6.3 Charger Robots (robot khiên) --- 6

Robot nặng mang khiên giáp phía trước, lao thẳng vào người chơi như tê
giác. Là mối đe dọa tầm gần buộc người chơi di chuyển, né và dùng địa
hình/grapple.

-   Hành vi: patrol, detect, wind-up (telegraph), charge, stunned,
    recover, destroyed.
-   **Giáp trước:** giảm 90% sát thương từ phía trước.
-   **Điểm yếu:** lưng và hông (hệ số crit 2x). Lộ rõ khi bị choáng.
-   **Telegraph:** 1.0 s trước khi lao: đèn đỏ, âm thanh, vạch đỏ trên
    mặt đất theo hướng lao.
-   **Hướng lao:** khóa tại lúc bắt đầu, không bẻ lái giữa chừng.
-   **Kết thúc cú lao:** va vào tường/container thì choáng 2.5 s và lộ
    lưng; trượt mục tiêu thì dừng sau quãng đường tối đa rồi hồi chiêu.
-   **Va chạm với người chơi:** gây damage và hất văng.
-   **An toàn môi trường:** raycast phía trước để phát hiện vật cản và
    mép cầu cảng; không lao ra khỏi mép dock.
-   **Khắc chế:** lách ngang, grapple lên cao, dụ đâm vào container, rồi
    bắn từ phía sau.

  Thuộc tính               Giá trị khởi điểm
  ----------------- ------------------------
  Số lượng                                 6
  HP                                     200
  Damage (va chạm)                        20
  Tốc độ đi                          3 m/s
  Tốc độ lao                  10--12 m/s (cao hơn tốc độ chạy người chơi)
  Quãng lao tối đa                     30 m
  Khoảng cách kích hoạt lao         8--25 m
  Detection range                       25 m
  Hồi chiêu                         ~6 s
  Giảm sát thương trước                90%
  Thời gian choáng khi va tường       2.5 s

**Yêu cầu level design:** Container Yard cần các lối thẳng dài tối thiểu
25--30 m, rộng khoảng 6 m, để Charger có chỗ lao. Phần lớn Charger đặt
ở Container Yard; số ít ở Warehouse (hành lang dài) và Dock (khu đất
trống).

### 6.4 AI and Simulation

-   Robot gần người chơi: AI, animation và va chạm đầy đủ.
-   Robot ở xa: giảm tần suất cập nhật AI; vẫn duy trì trạng thái logic
    cần thiết.
-   Robot ngoài vùng hoạt động: chuyển sang mô phỏng nhẹ hoặc trạng thái
    dormant, không được làm mất tiến trình gameplay.
-   Không dùng `InstancedMesh` cho robot có skeleton/animation độc lập
    nếu nó làm mất khả năng điều khiển từng cá thể. Có thể dùng chung
    geometry/material hoặc GPU instancing cho các phần tĩnh/lặp lại.
-   Giai đoạn đầu có thể dùng robot dạng primitive/procedural (cầu,
    thân hộp + chân) để chạy AI sớm; thay model thật sau.

## 7. Harbor World

Bản đồ là một bến cảng container công nghiệp có thể khám phá, gồm **4
zone**.

### 7.1 Zones

  Zone                           Nội dung
  ------------------------------ -----------------------------------------------
  A --- Container Yard           Dãy container dày, lối thẳng dài (cho Charger), đường đi và vật cản
  B --- Crane Zone               Nhiều cần cẩu giàn, dầm thép và điểm móc
  C --- Warehouse                Nhà kho, hành lang và khu vực tối
  D --- Dock + Control Center    Cầu cảng sát mặt nước, trung tâm điều khiển, khu đấu Boss

**Cargo Ship:** không còn là zone chơi được. Con tàu là mô hình tĩnh
đặt ngoài biển/cạnh bến làm cảnh quan (LOD thấp, không có nội thất,
không có AI hay nhiệm vụ).

### 7.2 Environment and Lighting

-   Thời điểm mặc định: buổi sáng, khoảng 07:00.
-   Directional sunlight chiếu xiên, bóng dài trên mặt bê tông.
-   Sóng biển được mô phỏng bằng shader; phản chiếu nước được cân đối
    theo cấu hình thiết bị.
-   Sương mỏng, gió, mây, đèn cảnh báo, khói và âm thanh môi trường.
-   Crane, tàu và một số thiết bị có animation nền nhẹ.
-   Công trình tĩnh ưu tiên baked lighting/shadows; dynamic shadows chỉ
    dành cho vật thể gameplay quan trọng.

### 7.3 World Interactions

-   Container và kết cấu cảng làm vật cản, nơi nấp và điểm định hướng.
-   Một số vật thể được phép phá hủy theo kịch bản.
-   Điểm móc được đánh dấu tường minh bằng metadata `grappleable`.
-   Không yêu cầu mô phỏng vật lý chi tiết cho toàn bộ container, tàu
    hoặc crane.

### 7.4 Cranes and Grapple Anchors

-   Số lượng crane đề xuất: **5--6**.
    -   3--4 crane trong Crane Zone.
    -   1 crane ở rìa Container Yard.
    -   1--2 crane quanh Dock/khu đấu Boss.
-   Dùng một model crane gốc, tạo biến thể bằng scale, màu và chiều cao.
    Dùng `THREE.LOD` cho thân crane.
-   **Quy tắc mật độ điểm móc:**
    -   Ở Crane Zone và Dock, mọi vị trí đi bộ được phải có ít nhất một
        điểm móc hợp lệ trong tầm bắn (40 m).
    -   Ở Container Yard, đỉnh các chồng container tầng trên cùng là
        điểm móc.
    -   Cột đèn và dầm thép bổ sung điểm móc giữa các crane.
-   Khu đấu Boss cần điểm móc ở nhiều độ cao để người chơi tiếp cận các
    điểm yếu ở trên cao (TITAN-04 cao 22 m).
-   Cần công cụ debug hiển thị vùng phủ điểm móc để kiểm tra quy tắc.

### 7.5 Containers

-   Số lượng lớn container, sinh bằng script theo lưới (hàng, cột, tầng,
    khoảng cách, màu), không đặt tay từng cái.
-   Render bằng `InstancedMesh` (một geometry, `instanceColor` cho màu).
    Đây là vật thể tĩnh lặp lại nên phù hợp với instancing.
-   Va chạm dùng box collider đơn giản, hợp nhất khi có thể; không dùng
    mesh collider.
-   Chừa các lối thẳng dài (xem 6.3) và các khoảng nấp cho người chơi.
-   Tầng trên cùng được đánh dấu `grappleable`.

## 8. Main Objective --- Four Hidden Activation Towers

Bốn trụ điều khiển khẩn cấp được bố trí ở các khu vực khác nhau:

  Tower   Khu vực gợi ý              Độ khó
  ------- ------------------------- -----------
  1       Warehouse                  Easy
  2       Container Yard             Medium
  3       Crane Zone                 Hard
  4       Dock + Control Center      Very Hard

Cần có gợi ý hướng đi (ví dụ chỉ báo hướng trên HUD, tín hiệu âm thanh
tăng dần khi đến gần, hoặc đánh dấu sau khi quét) để người chơi không
lạc trong lúc đồng hồ chạy. Chọn phương án khi playtest.

### 8.1 Activation

-   Người chơi đến trong phạm vi tương tác khoảng 2 m.
-   Nhấn và giữ E trong 5 giây.
-   Tiến trình bị gián đoạn nếu người chơi rời vùng tương tác hoặc bị hạ
    gục.
-   Khi kích hoạt thành công, trụ chuyển sang ánh sáng xanh, phát hiệu
    ứng và cập nhật HUD.
-   Có thể cần bảo vệ khu vực trong lúc kích hoạt; thời lượng và số đợt
    địch cần cân bằng khi playtest.

### 8.2 Nuclear Countdown

-   Countdown khởi điểm: 20 phút.
-   HUD hiển thị trạng thái 4 trụ và thời gian còn lại.
-   Nếu hết giờ khi chưa kích hoạt đủ bốn trụ: Nuclear Failure / Game
    Over.
-   Khi cả bốn trụ được kích hoạt: dừng countdown và bắt đầu sự kiện
    Boss.
-   Countdown là áp lực nhiệm vụ; thời gian cuối cùng cần kiểm thử với
    thời gian di chuyển và chiến đấu thực tế.

## 9. Final Boss --- TITAN-04

### 9.1 Concept

TITAN-04 là robot chiến đấu khổng lồ với thân hình cầu bọc giáp và bốn
chân cơ khí. Nó xuất hiện sau khi người chơi kích hoạt đủ bốn trụ, tại
khu đấu ở Dock + Control Center.

  Thuộc tính             Giá trị khởi điểm
  -------------------- -------------------
  Đường kính thân                     15 m
  Chiều cao tổng thể                  22 m
  Số chân                                4
  HP lõi                            4,000
  Số điểm yếu                            4
  Speed                            2.5 m/s

Kích thước, tốc độ và HP là giá trị thiết kế sơ bộ, cần kiểm tra tỷ lệ
với camera FPS, map và vũ khí thực tế. HP lõi đã giảm từ 10,000 (v1.1)
xuống 4,000 để khớp ngân sách đạn (mục 5.4); điều chỉnh tiếp sau
playtest để pha lõi không quá ngắn.

### 9.2 Four Red Weak Points

Bốn đèn đỏ bố trí quanh thân cầu: trước, sau, trái và phải.

-   Giáp thường miễn nhiễm hoặc giảm sát thương đến mức không thể kết
    liễu Boss.
-   Mỗi điểm yếu có HP riêng, giá trị khởi điểm 500.
-   Bắn trúng điểm yếu gây hiệu ứng tia lửa, đổi trạng thái đèn và phản
    hồi âm thanh.
-   Khi một điểm yếu bị phá hủy, Boss mất hoặc suy giảm một năng lực
    được xác định trước.
-   Chỉ khi cả bốn điểm yếu bị phá hủy, lõi trung tâm mới lộ ra và nhận
    sát thương kết liễu.
-   Khu đấu cần pickup đạn/medkit tiếp tế (mục 5.4) và điểm móc nhiều độ
    cao (mục 7.4).

### 9.3 Boss Phases

1.  **Awakening:** Boss xuất hiện, cinematic ngắn, khóa mục tiêu.
2.  **Weak-point hunt:** Người chơi di chuyển quanh Boss, dùng địa hình
    và grappling hook để bắn bốn điểm yếu.
3.  **Core exposed:** Cả bốn điểm yếu bị phá hủy; giáp trung tâm mở.
4.  **Final destruction:** Người chơi phá hủy lõi; Boss sụp đổ và phát
    nổ.

### 9.4 Attacks

  Attack            Ưu tiên          Mô tả
  ----------------- ---------------- --------------------------------------
  Heavy Cannon      Bắt buộc         Bắn pháo năng lượng
  Ground Slam       Bắt buộc         Dậm chân tạo sát thương vùng
  Missile Barrage   Bắt buộc         Loạt tên lửa có cảnh báo
  Shockwave         Tùy chọn         Sóng xung kích trên mặt đất
  Target Lock       Tùy chọn         Khóa vị trí người chơi
  EMP Pulse         Tùy chọn         Vô hiệu hóa tạm thời một số thiết bị

Ba đòn "Bắt buộc" đủ cho bản đầu; thêm các đòn "Tùy chọn" nếu còn thời
gian. Các đòn tấn công phải có telegraph rõ ràng và vùng tránh né hợp
lý.

## 10. HUD and UI

HUD hiển thị: - HP người chơi. - Đạn trong băng / đạn dự trữ. - Tên vũ
khí. - Nuclear countdown. - Tiến trình 4 trụ. - Chỉ báo hướng tới trụ
(nếu chọn, xem mục 8). - Tâm ngắm và hit marker. - Trong Boss Fight: tên
Boss, trạng thái 4 weak points và HP lõi.

Menu cần có Main Menu, Pause, Settings, Game Over và Victory. Settings
tối thiểu gồm độ nhạy chuột, âm lượng, chất lượng đồ họa và giới hạn
FPS.

## 11. Audio Design

  Nhóm          Nội dung
  ------------- ----------------------------------------------
  Environment   Sóng biển, gió, tiếng cảng
  Machinery     Crane, tàu, thiết bị công nghiệp
  Player        Bắn, nạp đạn, grappling
  Enemies       Di chuyển, phát hiện, tấn công, phá hủy; Charger: tiếng gầm/đèn báo trước khi lao, va tường
  Objective     Kích hoạt trụ, nuclear alarm
  Boss          Xuất hiện, từng đòn tấn công, hư hại, sụp đổ

Âm thanh phải chạy offline và được tải theo nhóm tài nguyên. Không tải
đồng thời mọi biến thể âm thanh nếu không cần.

## 12. Technical Architecture

### 12.1 Stack

  Thành phần            Công nghệ
  --------------------- -----------------------------------------------
  Language              TypeScript
  3D                    Three.js
  Build                 Vite
  Physics               Rapier (nếu cần rigid-body/character physics)
  Model                 GLB
  Model compression     Meshopt / Draco khi phù hợp
  Texture compression   KTX2 / Basis
  Audio                 Web Audio API
  Local persistence     IndexedDB / LocalStorage
  Hosting               Static hosting

### 12.2 Suggested Project Structure

``` text
src/
├── core/
│   ├── Game.ts
│   ├── SceneManager.ts
│   ├── Renderer.ts
│   ├── GameLoop.ts
│   └── InputManager.ts
├── assets/
│   ├── AssetManager.ts
│   ├── GLTFLoaderManager.ts
│   ├── TextureManager.ts
│   ├── ResourceTracker.ts
│   └── AssetCache.ts
├── streaming/            # tùy chọn, xem 13.1
│   ├── WorldStreamer.ts
│   ├── ZoneManager.ts
│   ├── AssetPreloader.ts
│   └── UnloadManager.ts
├── world/
│   ├── HarborWorld.ts
│   ├── Ocean.ts
│   ├── Crane.ts
│   ├── ContainerField.ts   # sinh container theo lưới, InstancedMesh
│   ├── ShipBackdrop.ts     # tàu tĩnh làm cảnh quan
│   ├── Warehouse.ts
│   ├── GrappleAnchors.ts   # đăng ký điểm móc, debug vùng phủ
│   ├── Pickups.ts          # ammo crate, medkit
│   └── Lighting.ts
├── player/
│   ├── Player.ts
│   ├── PlayerController.ts
│   ├── Weapon.ts
│   ├── Shooting.ts
│   ├── Reload.ts
│   └── GrapplingHook.ts
├── enemies/
│   ├── EnemyManager.ts
│   ├── SphereRobot.ts
│   ├── SpiderRobot.ts
│   ├── ChargerRobot.ts
│   └── EnemyAI.ts
├── boss/
│   ├── Titan04.ts
│   ├── BossAI.ts
│   ├── WeakPoints.ts
│   └── BossPhases.ts
├── objectives/
│   ├── TowerManager.ts
│   ├── ActivationTower.ts
│   └── NuclearCountdown.ts
├── systems/
│   ├── PhysicsSystem.ts
│   ├── CollisionSystem.ts
│   ├── AudioSystem.ts
│   ├── ParticleSystem.ts
│   ├── ObjectPool.ts
│   ├── LODManager.ts
│   ├── AIUpdateScheduler.ts
│   └── PerformanceMonitor.ts
└── ui/
    ├── HUD.ts
    ├── MainMenu.ts
    ├── PauseMenu.ts
    └── EndGame.ts
```

## 13. Performance and Memory Strategy

Performance is a core requirement, not a final optimization task. Do not
load every model, texture, animation and zone at startup.

### 13.1 Zone-based Streaming

Với 4 zone và 30 robot, toàn bộ bản đồ có thể vừa trong bộ nhớ. Zone
streaming là **tùy chọn**: quyết định sau benchmark ở M3 (RAM, GPU
memory, thời gian tải). Nếu bộ nhớ và thời gian tải đạt mục tiêu khi
tải toàn bộ theo nhóm, có thể bỏ streaming hoặc chỉ giữ preload nền. Nếu
áp dụng, các quy tắc dưới đây áp dụng:

-   Load core assets and the starting zone first.
-   Preload the next likely zone in the background.
-   Activate detailed assets when the player enters a zone.
-   Deactivate distant zones after a grace period.
-   Dispose only resources that are not shared or referenced by another
    active zone.
-   Keep compact gameplay state for enemies and objectives when a zone
    is unloaded.

### 13.2 Robot Loading and Simulation

  State        Rule
  ------------ ----------------------------------------
  Unloaded     Model chưa được tải
  Loading      Đang tải model/texture
  Active       Gần người chơi; AI và animation đầy đủ
  Simplified   Xa hơn; LOD thấp, AI giảm tần suất
  Dormant      Rất xa; mô phỏng tối thiểu
  Pooled       Tài nguyên instance được tái sử dụng

Nếu không dùng streaming (13.1), có thể rút gọn còn Active / Simplified
/ Dormant. Robot có thể được tải theo nhóm và dùng chung
geometry/material. Với robot có skeleton, dùng skeleton-aware cloning;
không dùng chung một skeleton đang được animate cho nhiều robot độc
lập. InstancedMesh phù hợp với chi tiết tĩnh lặp lại, không phải lựa
chọn mặc định cho nhân vật có animation độc lập.

### 13.3 LOD and Culling

-   Dùng `THREE.LOD` cho robot, tàu, crane và vật thể lớn.
-   Dùng frustum culling và giới hạn khoảng nhìn.
-   Dùng impostor/billboard hoặc mesh rất nhẹ cho vật thể xa khi phù
    hợp.
-   Không render chi tiết bên trong công trình nếu người chơi không thể
    nhìn thấy.
-   Hạn chế draw calls bằng geometry/material dùng chung và instancing
    cho vật thể tĩnh (đặc biệt container, xem 7.5).
-   Tàu trang trí dùng mesh rất nhẹ, không có nội thất.

### 13.4 Object Pooling

Pool các đối tượng tạo/hủy thường xuyên: - Đạn người chơi và đạn
robot. - Rocket và projectile của Boss. - Explosion, spark, muzzle
flash. - Particle và vỏ đạn. - Pickup rơi từ robot.

Giới hạn số lượng pool; khi pool đầy, bỏ hiệu ứng ít quan trọng thay vì
cấp phát vô hạn.

### 13.5 Texture and Geometry

-   Dùng KTX2/Basis cho texture GPU-compressed khi thiết bị hỗ trợ.
-   Dùng Meshopt hoặc Draco cho truyền tải geometry; đánh giá chi phí
    giải nén.
-   Dùng texture atlas cho nhóm vật thể tương tự.
-   Chọn độ phân giải texture theo kích thước trên màn hình.
-   Dùng chung material và geometry bất biến.
-   Tránh tải nhiều bản texture trùng lặp.

### 13.6 Lighting and Shadows

-   Một DirectionalLight chính mô phỏng mặt trời.
-   Bake ánh sáng/bóng cho crane, warehouse và các công trình tĩnh.
-   Dynamic shadow chỉ cho người chơi, robot gần và Boss khi cần.
-   Giới hạn shadow camera frustum theo vùng chơi.
-   Có preset chất lượng thấp/trung bình/cao; preset thấp giảm shadow
    resolution, hậu kỳ và khoảng nhìn.

### 13.7 AI Update Scheduling

Tần suất gợi ý ban đầu: - Gần người chơi: 20--30 Hz. - Tầm trung: 5--10
Hz. - Xa: 1--2 Hz hoặc mô phỏng trạng thái đơn giản. - Dormant:
event-driven.

Render loop độc lập với AI tick. Robot ở xa vẫn phải có trạng thái logic
hợp lệ, ví dụ tuần tra theo waypoint hoặc giữ trạng thái tấn công đã lên
lịch. Charger trong trạng thái wind-up/charge luôn được cập nhật ở tần
suất cao.

### 13.8 Resource Lifecycle

-   Theo dõi quyền sở hữu tài nguyên và số nơi đang tham chiếu.
-   Không dispose geometry/material/texture dùng chung khi một zone
    unload.
-   Khi tài nguyên không còn reference, gọi `dispose()` cho geometry,
    material, texture và render target liên quan.
-   Hủy event listener, timer, animation mixer và worker khi zone bị
    giải phóng.
-   Theo dõi cả JavaScript heap lẫn GPU resource; `renderer.info` là chỉ
    số chẩn đoán, không phải phép đo VRAM chính xác.

### 13.9 Performance Targets

Mục tiêu kiểm thử, không phải bảo đảm trên mọi thiết bị:

  Chỉ số                  Mục tiêu
  ----------------------- -------------------------------------------------------
  Desktop target          60 FPS
  Low-end fallback        30 FPS
  Enemy gameplay count    30
  Dynamic shadow lights   1 nguồn chính
  Zone loading            Background/preload (nếu dùng streaming)
  Memory                  Có ngân sách và cảnh báo
  Offline                 Không cần backend hoặc mạng sau khi cài/tải đủ assets

Cần benchmark trên ít nhất một máy cấu hình thấp mục tiêu và một máy cấu
hình trung bình. Nếu không đạt, ưu tiên giảm shadow, hậu kỳ, texture
resolution, view distance và số draw calls trước khi cắt nội dung
gameplay.

## 14. Save and Offline Requirements

-   Game không cần tài khoản, backend hoặc kết nối mạng trong lúc chơi.
-   Toàn bộ asset cần thiết phải được đóng gói hoặc cache cục bộ trước
    khi offline.
-   Lưu settings, best result và checkpoint (nếu có) bằng
    IndexedDB/LocalStorage.
-   Không phụ thuộc CDN runtime cho Three.js, model, texture hoặc audio
    trong bản offline.
-   Có thể dùng service worker để cache ứng dụng sau lần tải đầu, nhưng
    phải cung cấp hướng dẫn cài đặt/tải trước.

## 15. Development Milestones

  -----------------------------------------------------------------------
  Milestone               Nội dung                Exit criteria
  ----------------------- ----------------------- -----------------------
  M1                      FPS controller, weapon, Di chuyển và bắn ổn
                          reload                  định

  M2                      Harbor greybox (4       Đi lại, móc và va chạm
                          zone), container sinh   hoạt động; quy tắc
                          theo lưới, crane,       mật độ điểm móc đạt
                          grappling               

  M3                      Robot AI (cầu, nhện,    30 robot được quản lý
                          Charger) + benchmark    đúng; quyết định có
                          bộ nhớ                  dùng streaming hay
                                                  không

  M4                      Four towers + countdown Nhiệm vụ hoàn chỉnh;
                          + pickup đạn/máu        ngân sách đạn đạt

  M5                      TITAN-04 boss fight     Bốn weak points và core
                                                  phase hoạt động

  M6                      Optimization + offline  Đạt benchmark mục tiêu,
                          packaging               không leak tài nguyên
                                                  rõ rệt
  -----------------------------------------------------------------------

Chưa có ước lượng thời gian cho từng milestone; cần bổ sung dựa trên
quy mô đội ngũ.

### 15.1 Vertical Slice (kiểm tra độ vui trước khi mở rộng)

Một khu nhỏ trong Container Yard + Crane Zone gồm: di chuyển, bắn,
grapple, nhóm container và 1--2 crane, 1 robot cầu, 1 Charger, 1 trụ
kích hoạt, ammo crate, và boss greybox (hộp/cầu với 4 điểm yếu). Nếu
vòng chơi này chưa vui, chỉnh trước khi làm thêm nội dung.

### 15.2 Cut List (thứ tự cắt khi chậm tiến độ)

1.  Phản chiếu nước thực; dùng shader nước đơn giản.
2.  Baked lighting; dùng ánh sáng động đơn giản cho vùng nhỏ.
3.  Đòn Boss "Tùy chọn" (mục 9.4).
4.  Zone streaming (nếu benchmark không yêu cầu).
5.  Animation chi tiết của robot; dùng animation procedural.
6.  Giảm số robot (giữ tỷ lệ 14/10/6).

Không cắt: grapple, 4 trụ, Charger, bốn điểm yếu + lõi Boss.

## 16. Acceptance Criteria

### Player

-   [ ] WASD và mouse look.
-   [ ] Chuột trái bắn.
-   [ ] Chuột phải nạp đạn.
-   [ ] Space grappling hook (tầm 40 m, hồi 1.0 s).
-   [ ] E tương tác.
-   [ ] Collision không cho xuyên địa hình.
-   [ ] Ammo crate và medkit hoạt động.

### Weapon Asset

-   [ ] Có ghi nguồn GameBanana.
-   [ ] Đã kiểm tra archive và giấy phép trước khi phát hành.
-   [ ] Model/texture được chuyển đổi và kiểm tra trong Three.js.
-   [ ] View model hiển thị đúng góc nhìn.
-   [ ] Animation được xác minh hoặc thay thế hợp lệ.
-   [ ] Có phương án dự phòng (placeholder/CC0) nếu không đủ giấy phép.

### Enemies

-   [ ] Có 14 robot hình cầu.
-   [ ] Có 10 robot nhện.
-   [ ] Có 6 robot khiên Charger.
-   [ ] Patrol, detect, chase và attack (cầu, nhện).
-   [ ] Charger: telegraph, lao thẳng, choáng khi va tường, lộ lưng.
-   [ ] Giáp trước Charger giảm 90% sát thương; lưng/hông nhận crit.
-   [ ] Charger không lao qua mép cầu cảng.
-   [ ] AI/LOD/streaming không làm mất trạng thái gameplay.

### World

-   [ ] 4 zone: Container Yard, Crane Zone, Warehouse, Dock + Control
    Center.
-   [ ] Cargo ship là cảnh quan tĩnh ngoài biển.
-   [ ] 5--6 crane; mật độ điểm móc đạt quy tắc mục 7.4.
-   [ ] Container sinh theo lưới, dùng InstancedMesh; lối thẳng đủ cho
    Charger.
-   [ ] Ocean shader và môi trường buổi sáng.
-   [ ] Static baked shadows và dynamic shadows chọn lọc.
-   [ ] Zone streaming và unload an toàn (nếu dùng).

### Objectives and Boss

-   [ ] Bốn trụ có thể tìm và kích hoạt.
-   [ ] Có gợi ý hướng đi tới trụ.
-   [ ] Countdown và failure state.
-   [ ] Kích hoạt đủ trụ sẽ gọi Boss.
-   [ ] TITAN-04 có bốn chân và bốn điểm yếu đỏ.
-   [ ] Giáp không thể bị kết liễu trước khi phá hủy bốn điểm yếu.
-   [ ] Khu đấu Boss có điểm móc nhiều độ cao và tiếp tế đạn/máu.
-   [ ] Core phase và Victory hoạt động.

### Performance and Offline

-   [ ] Không tải toàn bộ asset không cần thiết khi khởi động.
-   [ ] Có LOD, culling, pooling và resource disposal.
-   [ ] Có monitor FPS, frame time, draw calls và resource counts.
-   [ ] Chạy được offline sau khi tải/cài đầy đủ.
-   [ ] Kiểm thử trên cấu hình thấp và trung bình.

------------------------------------------------------------------------

## 17. Open Questions / Items to Validate

1.  Xác minh archive GameBanana: tên file, loại model, texture,
    animation và giấy phép; chuẩn bị phương án thay thế.
2.  Chốt quy mô thực tế của bản đồ và thời gian hoàn thành bốn mục tiêu.
3.  Playtest countdown 20 phút và độ khó các đợt robot.
4.  Chốt thông số súng, HP robot, HP weak points và HP Boss; kiểm tra
    bảng ngân sách đạn (mục 5.4) và HP lõi 4,000.
5.  Benchmark asset streaming, RAM, GPU memory và FPS trên thiết bị mục
    tiêu; quyết định giữ hay bỏ streaming.
6.  Phím nạp đạn: giữ chuột phải hay đổi sang R (để dành chuột phải cho
    ngắm)?
7.  Có cần nhảy không? Hiện Space dành cho grapple.
8.  Cái chết: Game Over ngay hay checkpoint? Nếu có checkpoint, lưu ở
    đâu.
9.  Thông số Charger (tốc độ lao, quãng lao, hồi chiêu) so với tốc độ
    chạy người chơi.
10. Cách gợi ý hướng đi tới trụ (HUD, âm thanh hay quét).
11. Ước lượng thời gian cho từng milestone theo quy mô đội ngũ.

## 18. Reference Links

-   GameBanana mod page: https://gamebanana.com/mods/225079
-   GameBanana file download:
    https://gamebanana.com/mods/download/225079#FileInfo_391959
-   Three.js documentation: https://threejs.org/docs/
-   Three.js loading 3D models:
    https://threejs.org/manual/pages/loading-3d-models.html
-   Three.js cleanup: https://threejs.org/manual/pages/cleanup.html
-   Three.js LOD: https://threejs.org/docs/pages/LOD.html
