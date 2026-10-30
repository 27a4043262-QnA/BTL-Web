
"use strict";

/* =====================================================
   EDUTRACK - PROGRESS & PROGRESS DETAIL

   - Dashboard tiến độ 3 giai đoạn
   - Click giai đoạn để xem nhiệm vụ
   - Click tên nhiệm vụ để xem tài liệu
   - Chỉ click checkbox mới đổi trạng thái
   - Xem kiến thức, ví dụ và bài thực hành
   - Xem gợi ý đáp án
   - Lưu tiến độ bằng localStorage
   - Hỗ trợ lộ trình từ trang Tư vấn
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const main = document.querySelector(
        "[data-progress-page]"
    );

    if (!main) return;

    const PAGE = main.dataset.progressPage;

    const DEMO_KEY = "edutrack-progress-demo-v2";
    const SYNC_KEY = "edutrack-learning-roadmap-v1";

    const params = new URLSearchParams(
        window.location.search
    );

    const viewMode = params.get("view");

    /* =====================================================
       1. DỮ LIỆU MINH HỌA
       24 NHIỆM VỤ, 7 NHIỆM VỤ ĐÃ HOÀN THÀNH
       ===================================================== */

    const DEMO_DATA = {
        title: "Lộ trình học tập của bạn",
        stages: [
            {
                id: "1",
                title: "Củng cố nền tảng",
                subtitle: "Tuần 1–2",
                description:
                    "Ôn tập kiến thức quan trọng trước khi " +
                    "bắt đầu luyện các dạng bài nâng cao.",
                tasks: [
                    {
                        id: "1-1",
                        text: "Ôn lại SELECT và WHERE trong SQL",
                        done: true
                    },
                    {
                        id: "1-2",
                        text: "Hoàn thành bài tập SQL cơ bản",
                        done: true
                    },
                    {
                        id: "1-3",
                        text: "Xem video ôn tập cơ sở dữ liệu",
                        done: true
                    }
                ]
            },
            {
                id: "2",
                title: "Luyện tập nâng cao",
                subtitle: "Tuần 3–6",
                description:
                    "Rèn luyện kiến thức còn yếu và " +
                    "thực hành nhiều bài tập.",
                tasks: [
                    {
                        id: "2-1",
                        text: "Ôn INNER JOIN và LEFT JOIN",
                        done: true
                    },
                    {
                        id: "2-2",
                        text: "Làm bài tập JOIN nhiều bảng",
                        done: true
                    },
                    {
                        id: "2-3",
                        text: "Tìm hiểu Subquery",
                        done: true
                    },
                    {
                        id: "2-4",
                        text: "Làm bài tập truy vấn con cơ bản",
                        done: true
                    },
                    {
                        id: "2-5",
                        text: "Luyện GROUP BY và HAVING",
                        done: false
                    },
                    {
                        id: "2-6",
                        text: "Ôn lập trình hướng đối tượng C#",
                        done: false
                    },
                    {
                        id: "2-7",
                        text: "Thực hành class và object trong C#",
                        done: false
                    },
                    {
                        id: "2-8",
                        text: "Luyện kế thừa và đa hình",
                        done: false
                    },
                    {
                        id: "2-9",
                        text: "Ôn sơ đồ Use Case",
                        done: false
                    },
                    {
                        id: "2-10",
                        text: "Thực hành sơ đồ Activity",
                        done: false
                    },
                    {
                        id: "2-11",
                        text: "Giải bài tập tổng hợp",
                        done: false
                    },
                    {
                        id: "2-12",
                        text: "Tự đánh giá kiến thức còn yếu",
                        done: false
                    }
                ]
            },
            {
                id: "3",
                title: "Tăng tốc và hoàn thiện",
                subtitle: "Tuần 7–12",
                description:
                    "Tổng hợp kiến thức và chuẩn bị kiểm tra.",
                tasks: [
                    {
                        id: "3-1",
                        text: "Hệ thống lại toàn bộ kiến thức SQL",
                        done: false
                    },
                    {
                        id: "3-2",
                        text: "Luyện đề SQL tổng hợp",
                        done: false
                    },
                    {
                        id: "3-3",
                        text: "Ôn tập lập trình C#",
                        done: false
                    },
                    {
                        id: "3-4",
                        text: "Hoàn thành mini project C#",
                        done: false
                    },
                    {
                        id: "3-5",
                        text: "Ôn các mô hình UML",
                        done: false
                    },
                    {
                        id: "3-6",
                        text: "Làm bài tập phân tích hệ thống",
                        done: false
                    },
                    {
                        id: "3-7",
                        text: "Làm bài kiểm tra thử",
                        done: false
                    },
                    {
                        id: "3-8",
                        text: "Xem lại các câu trả lời sai",
                        done: false
                    },
                    {
                        id: "3-9",
                        text: "Đánh giá lại năng lực cuối lộ trình",
                        done: false
                    }
                ]
            }
        ]
    };

    /* =====================================================
       2. THƯ VIỆN TÀI LIỆU HỌC TẬP MINH HỌA

       Mỗi tài liệu gồm:
       - Kiến thức trọng tâm
       - Ví dụ
       - Bài thực hành
       - Gợi ý đáp án

       Đây là tài liệu minh họa được tích hợp
       trực tiếp vào website, không cần API.
       ===================================================== */

    const LESSONS = {

        sqlBasics: {
            title: "SQL cơ bản: SELECT và WHERE",
            intro:
                "SELECT dùng để truy xuất dữ liệu. " +
                "WHERE dùng để lọc các dòng thỏa mãn điều kiện.",
            points: [
                "SELECT * lấy tất cả cột của bảng.",
                "SELECT ten, diem chỉ lấy các cột được chọn.",
                "WHERE kết hợp với >, <, =, AND, OR để lọc dữ liệu."
            ],
            example:
                "SELECT ten, diem\n" +
                "FROM sinh_vien\n" +
                "WHERE diem >= 8;",
            practice:
                "Với bảng sinh_vien(ten, diem), " +
                "viết truy vấn lấy tên các sinh viên " +
                "có điểm lớn hơn hoặc bằng 7.",
            answer:
                "SELECT ten\n" +
                "FROM sinh_vien\n" +
                "WHERE diem >= 7;"
        },

        sqlJoin: {
            title: "SQL JOIN: kết hợp nhiều bảng",
            intro:
                "JOIN kết hợp các dòng từ nhiều bảng " +
                "dựa trên cột có quan hệ với nhau.",
            points: [
                "INNER JOIN chỉ lấy những dòng khớp ở hai bảng.",
                "LEFT JOIN giữ toàn bộ dòng của bảng bên trái.",
                "Điều kiện ON xác định cột dùng để liên kết."
            ],
            example:
                "SELECT sv.ten, l.ten_lop\n" +
                "FROM sinh_vien AS sv\n" +
                "INNER JOIN lop AS l\n" +
                "    ON sv.ma_lop = l.ma_lop;",
            practice:
                "Viết truy vấn lấy tên sinh viên " +
                "và tên lớp, kể cả khi sinh viên " +
                "chưa được xếp vào lớp.",
            answer:
                "SELECT sv.ten, l.ten_lop\n" +
                "FROM sinh_vien AS sv\n" +
                "LEFT JOIN lop AS l\n" +
                "    ON sv.ma_lop = l.ma_lop;"
        },

        sqlSubquery: {
            title: "SQL Subquery: truy vấn con",
            intro:
                "Subquery là truy vấn được đặt bên trong " +
                "một truy vấn khác để tạo dữ liệu " +
                "hoặc điều kiện lọc.",
            points: [
                "Truy vấn con thường đặt trong dấu ngoặc ().",
                "Có thể dùng Subquery với WHERE hoặc FROM.",
                "Chú ý truy vấn con trả về một giá trị hay nhiều dòng."
            ],
            example:
                "SELECT ten, diem\n" +
                "FROM sinh_vien\n" +
                "WHERE diem > (\n" +
                "    SELECT AVG(diem)\n" +
                "    FROM sinh_vien\n" +
                ");",
            practice:
                "Lấy danh sách sinh viên có điểm " +
                "lớn hơn điểm trung bình của cả lớp.",
            answer:
                "SELECT ten, diem\n" +
                "FROM sinh_vien\n" +
                "WHERE diem > (\n" +
                "    SELECT AVG(diem)\n" +
                "    FROM sinh_vien\n" +
                ");"
        },

        sqlGroup: {
            title: "GROUP BY và HAVING",
            intro:
                "GROUP BY nhóm các dòng dữ liệu. " +
                "HAVING lọc kết quả sau khi nhóm.",
            points: [
                "COUNT đếm, SUM tính tổng, AVG tính trung bình.",
                "WHERE lọc dòng trước khi nhóm.",
                "HAVING lọc nhóm sau khi thực hiện GROUP BY."
            ],
            example:
                "SELECT ma_lop, COUNT(*) AS so_luong\n" +
                "FROM sinh_vien\n" +
                "GROUP BY ma_lop\n" +
                "HAVING COUNT(*) >= 5;",
            practice:
                "Thống kê các lớp có ít nhất 10 sinh viên.",
            answer:
                "SELECT ma_lop, COUNT(*) AS so_luong\n" +
                "FROM sinh_vien\n" +
                "GROUP BY ma_lop\n" +
                "HAVING COUNT(*) >= 10;"
        },

        sqlReview: {
            title: "Tổng ôn SQL",
            intro:
                "Ôn lại những nhóm lệnh quan trọng " +
                "để xử lý dữ liệu trong cơ sở dữ liệu quan hệ.",
            points: [
                "SELECT, FROM, WHERE: truy xuất và lọc dữ liệu.",
                "JOIN: kết hợp dữ liệu giữa các bảng.",
                "GROUP BY, HAVING: tổng hợp và lọc theo nhóm.",
                "Subquery: sử dụng kết quả của truy vấn khác."
            ],
            example:
                "SELECT ma_lop, AVG(diem) AS diem_tb\n" +
                "FROM sinh_vien\n" +
                "WHERE diem IS NOT NULL\n" +
                "GROUP BY ma_lop;",
            practice:
                "Tự viết ba truy vấn: một truy vấn WHERE, " +
                "một truy vấn JOIN và một truy vấn GROUP BY.",
            answer:
                "Kiểm tra lần lượt:\n" +
                "1. WHERE có đúng điều kiện lọc không?\n" +
                "2. JOIN có điều kiện ON phù hợp không?\n" +
                "3. GROUP BY có đúng cột cần thống kê không?"
        },

        csharpOop: {
            title: "Lập trình hướng đối tượng C#",
            intro:
                "OOP giúp tổ chức chương trình bằng " +
                "các đối tượng có dữ liệu và hành vi.",
            points: [
                "Class là khuôn mẫu để tạo object.",
                "Đóng gói giúp kiểm soát cách truy cập dữ liệu.",
                "Kế thừa cho phép tái sử dụng và mở rộng class.",
                "Đa hình cho phép xử lý đối tượng qua kiểu chung."
            ],
            example:
                "class SinhVien\n" +
                "{\n" +
                "    public string Ten { get; set; } = \"\";\n" +
                "\n" +
                "    public void Chao()\n" +
                "    {\n" +
                "        Console.WriteLine($\"Xin chào {Ten}\");\n" +
                "    }\n" +
                "}",
            practice:
                "Tạo class MonHoc với hai thuộc tính " +
                "TenMon và SoTinChi.",
            answer:
                "class MonHoc\n" +
                "{\n" +
                "    public string TenMon { get; set; } = \"\";\n" +
                "    public int SoTinChi { get; set; }\n" +
                "}"
        },

        csharpClass: {
            title: "Thực hành Class và Object",
            intro:
                "Object là thể hiện cụ thể được tạo từ class. " +
                "Mỗi object có thể mang dữ liệu riêng.",
            points: [
                "Dùng từ khóa class để định nghĩa lớp.",
                "Dùng new để tạo một đối tượng.",
                "Thuộc tính mô tả dữ liệu của đối tượng."
            ],
            example:
                "class MonHoc\n" +
                "{\n" +
                "    public string Ten { get; set; } = \"\";\n" +
                "}\n\n" +
                "var mon = new MonHoc();\n" +
                "mon.Ten = \"Cơ sở dữ liệu\";\n" +
                "Console.WriteLine(mon.Ten);",
            practice:
                "Tạo hai đối tượng MonHoc có tên khác nhau " +
                "và in tên của cả hai ra màn hình.",
            answer:
                "var mon1 = new MonHoc { Ten = \"SQL\" };\n" +
                "var mon2 = new MonHoc { Ten = \"C#\" };\n" +
                "Console.WriteLine(mon1.Ten);\n" +
                "Console.WriteLine(mon2.Ten);"
        },

        csharpInheritance: {
            title: "Kế thừa và đa hình",
            intro:
                "Kế thừa tạo lớp con từ lớp cha. " +
                "Đa hình cho phép lớp con có cách " +
                "thực hiện phương thức riêng.",
            points: [
                "Dấu : dùng để khai báo lớp kế thừa.",
                "virtual cho phép phương thức được ghi đè.",
                "override cung cấp cách triển khai ở lớp con."
            ],
            example:
                "class Nguoi\n" +
                "{\n" +
                "    public virtual void GioiThieu()\n" +
                "    {\n" +
                "        Console.WriteLine(\"Xin chào\");\n" +
                "    }\n" +
                "}\n\n" +
                "class SinhVien : Nguoi\n" +
                "{\n" +
                "    public override void GioiThieu()\n" +
                "    {\n" +
                "        Console.WriteLine(\"Tôi là sinh viên\");\n" +
                "    }\n" +
                "}",
            practice:
                "Tạo một lớp GiangVien kế thừa từ Nguoi " +
                "và ghi đè phương thức GioiThieu.",
            answer:
                "class GiangVien : Nguoi\n" +
                "{\n" +
                "    public override void GioiThieu()\n" +
                "    {\n" +
                "        Console.WriteLine(\"Tôi là giảng viên\");\n" +
                "    }\n" +
                "}"
        },

        csharpProject: {
            title: "Hướng dẫn Mini Project C#",
            intro:
                "Xây dựng một ứng dụng Console nhỏ " +
                "để vận dụng class, object và xử lý dữ liệu.",
            points: [
                "Bước 1: Xác định yêu cầu của ứng dụng.",
                "Bước 2: Thiết kế class quản lý dữ liệu.",
                "Bước 3: Viết chức năng thêm và hiển thị dữ liệu.",
                "Bước 4: Kiểm tra trường hợp dữ liệu nhập sai."
            ],
            example:
                "class CongViec\n" +
                "{\n" +
                "    public string Ten { get; set; } = \"\";\n" +
                "    public bool HoanThanh { get; set; }\n" +
                "}",
            practice:
                "Tạo ứng dụng quản lý việc học có thể " +
                "thêm nhiệm vụ, liệt kê và đánh dấu hoàn thành.",
            answer:
                "Gợi ý cấu trúc:\n" +
                "- Class CongViec lưu tên và trạng thái.\n" +
                "- List<CongViec> lưu danh sách.\n" +
                "- Menu Console gọi các chức năng.\n" +
                "- Kiểm tra dữ liệu trước khi thêm."
        },

        umlUsecase: {
            title: "UML Use Case Diagram",
            intro:
                "Use Case mô tả các chức năng hệ thống " +
                "nhìn từ góc độ người sử dụng.",
            points: [
                "Actor là vai trò tương tác với hệ thống.",
                "Use Case thể hiện một mục tiêu hoặc chức năng.",
                "Ranh giới hệ thống chứa các Use Case.",
                "Quan hệ include và extend có ý nghĩa khác nhau."
            ],
            example:
                "Ví dụ hệ thống EduTrack:\n" +
                "Actor: Sinh viên\n" +
                "Use Case: Đăng nhập\n" +
                "Use Case: Xem tiến độ\n" +
                "Use Case: Đánh dấu hoàn thành",
            practice:
                "Xác định actor và các Use Case " +
                "cho hệ thống mượn sách thư viện.",
            answer:
                "Actor có thể là Độc giả và Thủ thư.\n" +
                "Use Case: Tìm sách, Mượn sách, " +
                "Trả sách, Quản lý sách."
        },

        umlActivity: {
            title: "UML Activity Diagram",
            intro:
                "Activity Diagram mô tả luồng thực hiện " +
                "các bước công việc hoặc quy trình.",
            points: [
                "Nút bắt đầu xác định điểm khởi đầu.",
                "Action thể hiện một hoạt động.",
                "Decision dùng để rẽ nhánh theo điều kiện.",
                "Nút kết thúc thể hiện điểm kết thúc quy trình."
            ],
            example:
                "Bắt đầu\n" +
                "  ↓\n" +
                "Nhập tài khoản\n" +
                "  ↓\n" +
                "Kiểm tra hợp lệ\n" +
                "  ├─ Đúng → Vào hệ thống\n" +
                "  └─ Sai → Thông báo lỗi",
            practice:
                "Vẽ Activity Diagram cho quy trình " +
                "nộp bài tập trực tuyến.",
            answer:
                "Gợi ý luồng:\n" +
                "Bắt đầu → Chọn môn → Chọn bài tập →\n" +
                "Tải tệp lên → Kiểm tra hợp lệ →\n" +
                "Nộp bài → Kết thúc.\n" +
                "Thêm nhánh thông báo nếu tệp không hợp lệ."
        },

        umlOverview: {
            title: "Tổng ôn các sơ đồ UML",
            intro:
                "UML hỗ trợ mô hình hóa yêu cầu, " +
                "cấu trúc và hành vi của hệ thống.",
            points: [
                "Use Case: ai sử dụng và sử dụng chức năng nào.",
                "Activity: các bước thực hiện quy trình.",
                "Class: lớp, thuộc tính, phương thức và quan hệ.",
                "Sequence: thứ tự trao đổi thông điệp."
            ],
            example:
                "Bài toán: Quản lý môn học\n" +
                "Use Case: Thêm môn, Xem môn\n" +
                "Class: MonHoc, SinhVien\n" +
                "Activity: Quy trình thêm môn học",
            practice:
                "Chọn sơ đồ phù hợp để mô tả " +
                "cấu trúc class của ứng dụng.",
            answer:
                "Dùng Class Diagram vì sơ đồ này " +
                "mô tả các lớp, thuộc tính, phương thức " +
                "và mối quan hệ giữa chúng."
        },

        umlAnalysis: {
            title: "Bài tập phân tích hệ thống",
            intro:
                "Phân tích hệ thống bắt đầu bằng việc " +
                "xác định yêu cầu và cách các thành phần tương tác.",
            points: [
                "Xác định các nhóm người sử dụng.",
                "Viết yêu cầu chức năng và phi chức năng.",
                "Mô tả luồng xử lý chính.",
                "Lựa chọn sơ đồ UML để thể hiện yêu cầu."
            ],
            example:
                "Yêu cầu: Sinh viên theo dõi tiến độ.\n" +
                "Chức năng: Xem nhiệm vụ, cập nhật trạng thái.\n" +
                "Phi chức năng: Giao diện dễ sử dụng.",
            practice:
                "Viết ba yêu cầu chức năng " +
                "cho website quản lý học tập.",
            answer:
                "Ví dụ:\n" +
                "1. Sinh viên xem danh sách môn học.\n" +
                "2. Sinh viên xem lộ trình học tập.\n" +
                "3. Sinh viên cập nhật nhiệm vụ hoàn thành."
        },

        mixedPractice: {
            title: "Phương pháp luyện bài tổng hợp",
            intro:
                "Bài tập tổng hợp kiểm tra khả năng " +
                "kết hợp nhiều kiến thức vào một bài toán.",
            points: [
                "Đọc kỹ yêu cầu và xác định đầu ra cần có.",
                "Chia bài toán lớn thành các phần nhỏ.",
                "Kiểm tra dữ liệu đầu vào và trường hợp đặc biệt.",
                "Ghi lại lỗi sai để ôn tập."
            ],
            example:
                "Ví dụ SQL:\n" +
                "- Lọc sinh viên theo điểm.\n" +
                "- Kết hợp bảng lớp học.\n" +
                "- Thống kê số sinh viên theo lớp.",
            practice:
                "Lên kế hoạch giải bài tập tổng hợp " +
                "bằng cách chia thành ít nhất ba bước.",
            answer:
                "Gợi ý:\n" +
                "1. Xác định bảng và dữ liệu cần dùng.\n" +
                "2. Viết truy vấn từng phần.\n" +
                "3. Ghép truy vấn và kiểm tra kết quả."
        },

        selfEvaluate: {
            title: "Tự đánh giá năng lực học tập",
            intro:
                "Tự đánh giá giúp xác định những kiến thức " +
                "đã nắm chắc và những phần cần học lại.",
            points: [
                "Liệt kê từng chủ đề đã học.",
                "Xếp mức độ hiểu: tốt, trung bình hoặc còn yếu.",
                "Làm bài tập không nhìn tài liệu.",
                "Ưu tiên ôn lại chủ đề còn sai nhiều."
            ],
            example:
                "SQL SELECT: Tốt\n" +
                "SQL JOIN: Trung bình\n" +
                "SQL Subquery: Cần ôn thêm",
            practice:
                "Tạo bảng tự đánh giá cho ba chủ đề " +
                "bạn đang học.",
            answer:
                "Bảng nên có các cột:\n" +
                "Chủ đề | Mức độ hiểu | Lỗi thường gặp | " +
                "Hành động tiếp theo."
        },

        mockTest: {
            title: "Hướng dẫn làm bài kiểm tra thử",
            intro:
                "Kiểm tra thử giúp xác định khả năng " +
                "vận dụng kiến thức khi không xem tài liệu.",
            points: [
                "Chuẩn bị bộ câu hỏi từ các chủ đề đã học.",
                "Tự đặt thời gian làm bài.",
                "Không xem lời giải khi đang làm.",
                "Chấm lại và ghi chú lý do của từng câu sai."
            ],
            example:
                "Câu hỏi mẫu:\n" +
                "Trong SQL, lệnh nào dùng để lọc nhóm?\n" +
                "A. WHERE\n" +
                "B. HAVING\n" +
                "C. ORDER BY",
            practice:
                "Trả lời câu hỏi mẫu mà không nhìn tài liệu.",
            answer:
                "Đáp án: B. HAVING.\n" +
                "HAVING lọc kết quả sau GROUP BY; " +
                "WHERE lọc các dòng trước khi nhóm."
        },

        mistakeReview: {
            title: "Phân tích và sửa lỗi sai",
            intro:
                "Xem lại lỗi sai giúp cải thiện " +
                "khả năng hiểu và tránh lặp lại lỗi.",
            points: [
                "Phân loại lỗi: thiếu kiến thức hay đọc sai đề.",
                "Tìm nguyên nhân thay vì chỉ ghi đáp án.",
                "Làm lại bài tương tự sau khi ôn tập.",
                "Kiểm tra lại sau một khoảng thời gian."
            ],
            example:
                "Lỗi: Dùng WHERE COUNT(*) > 5.\n" +
                "Nguyên nhân: Nhầm WHERE và HAVING.\n" +
                "Sửa: HAVING COUNT(*) > 5.",
            practice:
                "Chọn hai câu đã làm sai và ghi " +
                "nguyên nhân cùng cách sửa.",
            answer:
                "Mẫu ghi chú:\n" +
                "- Câu hỏi\n" +
                "- Đáp án đã chọn\n" +
                "- Nguyên nhân sai\n" +
                "- Cách giải đúng\n" +
                "- Ngày ôn tập lại"
        },

        finalAssessment: {
            title: "Đánh giá cuối lộ trình",
            intro:
                "Cuối lộ trình, hãy so sánh năng lực " +
                "hiện tại với mục tiêu ban đầu.",
            points: [
                "Thống kê số nhiệm vụ đã hoàn thành.",
                "Kiểm tra lại các chủ đề từng gặp khó khăn.",
                "Đánh giá kết quả bài tập hoặc bài kiểm tra.",
                "Đề xuất mục tiêu học tập cho giai đoạn tiếp theo."
            ],
            example:
                "Mục tiêu: Nắm chắc SQL JOIN.\n" +
                "Minh chứng: Tự viết được JOIN hai bảng.\n" +
                "Bước tiếp theo: Luyện JOIN nhiều bảng.",
            practice:
                "Viết bản tổng kết học tập gồm ba phần: " +
                "đã tiến bộ, còn hạn chế và mục tiêu tiếp theo.",
            answer:
                "Bản tổng kết nên dựa trên kết quả " +
                "bài tập và kỹ năng thực tế, " +
                "không chỉ dựa vào số checkbox đã tích."
        },

        general: {
            title: "Hướng dẫn thực hiện nhiệm vụ",
            intro:
                "Hãy thực hiện nhiệm vụ theo lộ trình " +
                "đã được đề xuất cho bạn.",
            points: [
                "Đọc lại yêu cầu của nhiệm vụ.",
                "Tìm hiểu kiến thức liên quan.",
                "Thực hành bằng một ví dụ cụ thể.",
                "Tự kiểm tra kết quả trước khi hoàn thành."
            ],
            example:
                "Bước 1: Xác định nội dung cần học.\n" +
                "Bước 2: Đọc tài liệu.\n" +
                "Bước 3: Làm bài tập.\n" +
                "Bước 4: Tự đánh giá.",
            practice:
                "Thực hiện nhiệm vụ theo kế hoạch " +
                "và ghi lại kết quả học tập.",
            answer:
                "Chỉ đánh dấu hoàn thành khi bạn " +
                "đã thực sự thực hiện nhiệm vụ."
        }
    };

    /* =====================================================
       3. GẮN TÀI LIỆU VỚI TỪNG NHIỆM VỤ DEMO
       ===================================================== */

    const DEMO_LESSON_MAP = {
        "1-1": "sqlBasics",
        "1-2": "sqlBasics",
        "1-3": "sqlBasics",

        "2-1": "sqlJoin",
        "2-2": "sqlJoin",
        "2-3": "sqlSubquery",
        "2-4": "sqlSubquery",
        "2-5": "sqlGroup",
        "2-6": "csharpOop",
        "2-7": "csharpClass",
        "2-8": "csharpInheritance",
        "2-9": "umlUsecase",
        "2-10": "umlActivity",
        "2-11": "mixedPractice",
        "2-12": "selfEvaluate",

        "3-1": "sqlReview",
        "3-2": "sqlReview",
        "3-3": "csharpOop",
        "3-4": "csharpProject",
        "3-5": "umlOverview",
        "3-6": "umlAnalysis",
        "3-7": "mockTest",
        "3-8": "mistakeReview",
        "3-9": "finalAssessment"
    };

    function normalizeText(value) {
        return String(value)
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .trim();
    }

    function getLesson(task, source) {
        if (source === "demo") {
            const lessonKey = DEMO_LESSON_MAP[task.id];

            if (lessonKey && LESSONS[lessonKey]) {
                return LESSONS[lessonKey];
            }
        }

        // Chọn tài liệu phù hợp cho nhiệm vụ
        // được đồng bộ từ trang Tư vấn.
        const text = normalizeText(task.text);

        if (
            text.includes("subquery") ||
            text.includes("truy van con")
        ) {
            return LESSONS.sqlSubquery;
        }

        if (text.includes("join")) {
            return LESSONS.sqlJoin;
        }

        if (
            text.includes("group by") ||
            text.includes("having")
        ) {
            return LESSONS.sqlGroup;
        }

        if (
            text.includes("select") ||
            text.includes("where")
        ) {
            return LESSONS.sqlBasics;
        }

        if (
            text.includes("sql") ||
            text.includes("co so du lieu") ||
            text.includes("csdl")
        ) {
            return LESSONS.sqlReview;
        }

        if (
            text.includes("ke thua") ||
            text.includes("da hinh")
        ) {
            return LESSONS.csharpInheritance;
        }

        if (
            text.includes("class") ||
            text.includes("object")
        ) {
            return LESSONS.csharpClass;
        }

        if (
            text.includes("project") &&
            text.includes("c#")
        ) {
            return LESSONS.csharpProject;
        }

        if (
            text.includes("c#") ||
            text.includes("lap trinh huong doi tuong")
        ) {
            return LESSONS.csharpOop;
        }

        if (text.includes("use case")) {
            return LESSONS.umlUsecase;
        }

        if (text.includes("activity")) {
            return LESSONS.umlActivity;
        }

        if (text.includes("uml")) {
            return LESSONS.umlOverview;
        }

        if (text.includes("phan tich he thong")) {
            return LESSONS.umlAnalysis;
        }

        if (
            text.includes("kiem tra") ||
            text.includes("luyen de")
        ) {
            return LESSONS.mockTest;
        }

        if (text.includes("loi sai")) {
            return LESSONS.mistakeReview;
        }

        if (text.includes("danh gia")) {
            return LESSONS.selfEvaluate;
        }

        return LESSONS.general;
    }

    /* =====================================================
       4. HÀM DOM VÀ LOCAL STORAGE
       ===================================================== */

    function byId(id) {
        return document.getElementById(id);
    }

    function createElement(tag, className, content) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (content !== undefined) {
            element.textContent = String(content);
        }

        return element;
    }

    function readStorage(key) {
        try {
            const value = localStorage.getItem(key);

            return value ? JSON.parse(value) : null;
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );
            return true;
        } catch (error) {
            return false;
        }
    }

    function cloneDemo() {
        return JSON.parse(
            JSON.stringify(DEMO_DATA)
        );
    }

    function isValidTask(task) {
        return Boolean(
            task &&
            typeof task.id === "string" &&
            typeof task.text === "string"
        );
    }

    function isValidDemo(data) {
        return Boolean(
            data &&
            Array.isArray(data.stages) &&
            data.stages.length === 3 &&
            data.stages.every(stage =>
                stage &&
                Array.isArray(stage.tasks) &&
                stage.tasks.every(isValidTask)
            )
        );
    }

    /* =====================================================
       5. ĐỌC LỘ TRÌNH TỪ TRANG TƯ VẤN
       ===================================================== */

    function readSyncedRoadmap() {
        const saved = readStorage(SYNC_KEY);

        if (
            !saved ||
            saved.version !== 1 ||
            !Array.isArray(saved.weeks) ||
            saved.weeks.length === 0
        ) {
            return null;
        }

        const stages = saved.weeks.map((week, index) => ({
            id: String(index + 1),

            title: String(
                week.subtitle ||
                week.title ||
                `Tuần ${index + 1}`
            ),

            subtitle: String(
                week.title ||
                `Tuần ${index + 1}`
            ),

            description: week.duration
                ? `Thời gian dự kiến: ${week.duration}`
                : "Hoàn thành các nhiệm vụ theo kế hoạch.",

            tasks: Array.isArray(week.tasks)
                ? week.tasks
                    .filter(isValidTask)
                    .map(task => ({
                        id: task.id,
                        text: task.text,
                        done: task.done === true
                    }))
                : []
        }));

        if (
            !stages.some(stage => stage.tasks.length > 0)
        ) {
            return null;
        }

        return {
            source: "synced",
            title: String(
                saved.title || "Lộ trình từ trang Tư vấn"
            ),
            stages
        };
    }

    function getProgressData() {
        if (viewMode === "empty") {
            return null;
        }

        if (viewMode !== "demo") {
            const synced = readSyncedRoadmap();

            if (synced) {
                return synced;
            }
        }

        const stored = readStorage(DEMO_KEY);

        const data = isValidDemo(stored)
            ? stored
            : cloneDemo();

        return {
            source: "demo",
            title: data.title,
            stages: data.stages
        };
    }

    /* =====================================================
       6. TÍNH TOÁN TIẾN ĐỘ
       ===================================================== */

    function getStageStats(stage) {
        const total = stage.tasks.length;

        const completed = stage.tasks.filter(
            task => task.done
        ).length;

        return {
            total,
            completed,
            remaining: total - completed,
            percentage: total
                ? Math.round(completed / total * 100)
                : 0
        };
    }

    function getOverallStats(data) {
        const allTasks = data.stages.flatMap(
            stage => stage.tasks
        );

        const total = allTasks.length;

        const completed = allTasks.filter(
            task => task.done
        ).length;

        const completedStages = data.stages.filter(
            stage => {
                const stats = getStageStats(stage);

                return (
                    stats.total > 0 &&
                    stats.completed === stats.total
                );
            }
        ).length;

        return {
            total,
            completed,
            remaining: total - completed,
            percentage: total
                ? Math.round(completed / total * 100)
                : 0,
            completedStages
        };
    }

    function getStageStatus(stage) {
        const stats = getStageStats(stage);

        if (
            stats.total > 0 &&
            stats.completed === stats.total
        ) {
            return {
                label: "Hoàn thành",
                cssClass: "is-complete"
            };
        }

        if (stats.completed > 0) {
            return {
                label: "Đang học",
                cssClass: "is-active"
            };
        }

        return {
            label: "Chưa bắt đầu",
            cssClass: ""
        };
    }

    function getNextTask(data) {
        for (const stage of data.stages) {
            const task = stage.tasks.find(
                item => !item.done
            );

            if (task) {
                return { stage, task };
            }
        }

        return null;
    }

    /* =====================================================
       7. LƯU TIẾN ĐỘ
       CHỈ ĐƯỢC GỌI KHI CHECKBOX THAY ĐỔI
       ===================================================== */

    function saveTaskState(data, stageId, taskId, done) {

        if (data.source === "synced") {
            const original = readStorage(SYNC_KEY);

            if (
                !original ||
                !Array.isArray(original.weeks)
            ) {
                return false;
            }

            const weekIndex = Number(stageId) - 1;

            const week = original.weeks[weekIndex];

            if (
                !Number.isInteger(weekIndex) ||
                !week ||
                !Array.isArray(week.tasks)
            ) {
                return false;
            }

            const task = week.tasks.find(
                item => item.id === taskId
            );

            if (!task) return false;

            task.done = done;

            return writeStorage(
                SYNC_KEY,
                original
            );
        }

        const stored = readStorage(DEMO_KEY);

        const demo = isValidDemo(stored)
            ? stored
            : cloneDemo();

        const stage = demo.stages.find(
            item => item.id === stageId
        );

        if (!stage) return false;

        const task = stage.tasks.find(
            item => item.id === taskId
        );

        if (!task) return false;

        task.done = done;

        return writeStorage(
            DEMO_KEY,
            demo
        );
    }

    /* =====================================================
       8. THANH TIẾN ĐỘ VÀ NHÃN TRẠNG THÁI
       ===================================================== */

    function createProgressBar(percentage, label) {
        const track = createElement(
            "div",
            "ep-progress-track"
        );

        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", label);
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute(
            "aria-valuenow",
            String(percentage)
        );

        const fill = createElement("span");
        fill.style.width = `${percentage}%`;

        track.appendChild(fill);

        return track;
    }

    function createStatusBadge(stage) {
        const status = getStageStatus(stage);

        return createElement(
            "span",
            `ep-status-badge ${status.cssClass}`,
            status.label
        );
    }

    function detailUrl(stageId, taskId = null) {
        const url = new URL(
            "progress-detail.html",
            window.location.href
        );

        url.searchParams.set("phase", stageId);

        if (taskId !== null) {
            url.searchParams.set("task", taskId);
        }

        if (viewMode === "demo") {
            url.searchParams.set("view", "demo");
        }

        return url.href;
    }

    /* =====================================================
       9. TẠO PANEL TÀI LIỆU CHO NHIỆM VỤ
       ===================================================== */

    let activeLearningKey = null;
    let initializedLearningFromUrl = false;

    function getTaskKey(stageId, taskId) {
        return `${stageId}::${taskId}`;
    }

    function createLearningPanel(
        task,
        lesson,
        panelId,
        answerId,
        expanded
    ) {
        const panel = createElement(
            "section",
            "ep-learning-panel"
        );

        panel.id = panelId;
        panel.hidden = !expanded;

        const heading = createElement(
            "div",
            "ep-learning-heading"
        );

        heading.appendChild(
            createElement(
                "span",
                "ep-learning-icon",
                "📖"
            )
        );

        heading.appendChild(
            createElement(
                "h3",
                "",
                lesson.title
            )
        );

        panel.appendChild(heading);

        panel.appendChild(
            createElement(
                "p",
                "ep-learning-intro",
                lesson.intro
            )
        );

        panel.appendChild(
            createElement(
                "h4",
                "ep-learning-section-title",
                "Kiến thức trọng tâm"
            )
        );

        const points = createElement(
            "ul",
            "ep-learning-points"
        );

        lesson.points.forEach(point => {
            points.appendChild(
                createElement("li", "", point)
            );
        });

        panel.appendChild(points);

        panel.appendChild(
            createElement(
                "h4",
                "ep-learning-section-title",
                "Ví dụ minh họa"
            )
        );

        panel.appendChild(
            createElement(
                "pre",
                "ep-learning-example",
                lesson.example
            )
        );

        // Bài thực hành và gợi ý đáp án.
        const practiceBox = createElement(
            "section",
            "ep-learning-practice-box"
        );

        practiceBox.appendChild(
            createElement(
                "h4",
                "ep-learning-section-title",
                "Bài thực hành"
            )
        );

        practiceBox.appendChild(
            createElement(
                "p",
                "ep-learning-practice",
                lesson.practice
            )
        );

        const answerButton = createElement(
            "button",
            "ep-answer-toggle",
            "Xem gợi ý đáp án ▾"
        );

        answerButton.type = "button";
        answerButton.setAttribute(
            "aria-expanded",
            "false"
        );
        answerButton.setAttribute(
            "aria-controls",
            answerId
        );

        const answer = createElement(
            "div",
            "ep-answer-content",
            lesson.answer
        );

        answer.id = answerId;
        answer.hidden = true;

        practiceBox.appendChild(answerButton);
        practiceBox.appendChild(answer);

        panel.appendChild(practiceBox);

        panel.appendChild(
            createElement(
                "p",
                "ep-learning-note",
                "Bạn đang học nhiệm vụ: " +
                task.text +
                ". Đọc tài liệu và làm bài không tự tích " +
                "hoàn thành. Chỉ ô checkbox bên cạnh " +
                "nhiệm vụ mới cập nhật tiến độ."
            )
        );

        return panel;
    }

    /* =====================================================
       10. TẠO DANH SÁCH NHIỆM VỤ

       Checkbox đứng RIÊNG.
       Không bọc cả dòng bằng thẻ <label>.

       Dashboard:
       - Click tên -> đến trang chi tiết.

       Trang chi tiết:
       - Click tên -> mở tài liệu ngay tại chỗ.
       ===================================================== */

    function createTaskList(stage, data, isDetail) {
        const list = createElement(
            "ul",
            "ep-task-list"
        );

        const stageIndex = data.stages.findIndex(
            item => item.id === stage.id
        );

        stage.tasks.forEach((task, taskIndex) => {
            const taskKey = getTaskKey(
                stage.id,
                task.id
            );

            const expanded = (
                isDetail &&
                activeLearningKey === taskKey
            );

            const item = createElement(
                "li",
                "ep-task-item"
            );

            if (task.done) {
                item.classList.add("is-done");
            }

            if (expanded) {
                item.classList.add("is-open");
            }

            const row = createElement(
                "div",
                "ep-task-row"
            );

            /* CHECKBOX ĐỘC LẬP */
            const checkbox = document.createElement(
                "input"
            );

            checkbox.type = "checkbox";
            checkbox.className = "ep-task-check";
            checkbox.checked = task.done;

            checkbox.dataset.stageId = stage.id;
            checkbox.dataset.taskId = task.id;

            checkbox.setAttribute(
                "aria-label",
                "Đánh dấu hoàn thành: " + task.text
            );

            row.appendChild(checkbox);

            /* TÊN NHIỆM VỤ */
            const action = createElement(
                isDetail ? "button" : "a",
                isDetail
                    ? "ep-task-open"
                    : "ep-task-link"
            );

            if (isDetail) {
                action.type = "button";

                action.dataset.taskKey = taskKey;

                const panelId =
                    `ep-learning-${stageIndex}-${taskIndex}`;

                action.setAttribute(
                    "aria-controls",
                    panelId
                );

                action.setAttribute(
                    "aria-expanded",
                    String(expanded)
                );

            } else {
                action.href = detailUrl(
                    stage.id,
                    task.id
                );
            }

            action.appendChild(
                createElement(
                    "span",
                    "ep-task-name",
                    task.text
                )
            );

            action.appendChild(
                createElement(
                    "span",
                    "ep-task-action",
                    isDetail
                        ? (expanded
                            ? "Thu gọn ▲"
                            : "Xem tài liệu ▾")
                        : "Học bài →"
                )
            );

            row.appendChild(action);
            item.appendChild(row);

            /* TÀI LIỆU CHỈ CÓ Ở TRANG CHI TIẾT */
            if (isDetail) {
                const panelId =
                    `ep-learning-${stageIndex}-${taskIndex}`;

                const answerId =
                    `ep-answer-${stageIndex}-${taskIndex}`;

                const lesson = getLesson(
                    task,
                    data.source
                );

                item.appendChild(
                    createLearningPanel(
                        task,
                        lesson,
                        panelId,
                        answerId,
                        expanded
                    )
                );
            }

            list.appendChild(item);
        });

        return list;
    }

    /* =====================================================
       11. ACCORDION GIAI ĐOẠN TRÊN DASHBOARD
       ===================================================== */

    const expandedStages = new Set();
    let accordionInitialized = false;

    function createStageCard(stage, index, data) {
        const stats = getStageStats(stage);
        const status = getStageStatus(stage);

        const details = createElement(
            "details",
            "ep-stage"
        );

        details.dataset.stage = stage.id;
        details.open = expandedStages.has(stage.id);

        if (status.cssClass === "is-complete") {
            details.classList.add("is-complete");
        }

        const summary = createElement(
            "summary",
            "ep-stage-summary"
        );

        summary.appendChild(
            createElement(
                "span",
                "ep-stage-number",
                String(index + 1)
            )
        );

        const info = createElement(
            "div",
            "ep-stage-info"
        );

        info.appendChild(
            createElement(
                "h3",
                "ep-stage-title",
                `Giai đoạn ${index + 1}: ${stage.title}`
            )
        );

        info.appendChild(
            createElement(
                "p",
                "ep-stage-subtitle",
                stage.subtitle
            )
        );

        info.appendChild(
            createElement(
                "p",
                "ep-stage-counter",
                `${stats.completed}/${stats.total} nhiệm vụ · ` +
                `${stats.percentage}%`
            )
        );

        summary.appendChild(info);

        const right = createElement(
            "div",
            "ep-stage-right"
        );

        right.appendChild(
            createStatusBadge(stage)
        );

        right.appendChild(
            createElement(
                "span",
                "ep-stage-chevron",
                "⌄"
            )
        );

        summary.appendChild(right);

        const bottom = createElement(
            "div",
            "ep-stage-bottom"
        );

        bottom.appendChild(
            createProgressBar(
                stats.percentage,
                `Tiến độ giai đoạn ${index + 1}`
            )
        );

        const body = createElement(
            "div",
            "ep-stage-body"
        );

        body.appendChild(
            createElement(
                "p",
                "ep-stage-description",
                stage.description
            )
        );

        body.appendChild(
            createTaskList(stage, data, false)
        );

        const actions = createElement(
            "div",
            "ep-stage-actions"
        );

        const link = createElement(
            "a",
            "ep-button ep-button-secondary",
            "Xem chi tiết đầy đủ →"
        );

        link.href = detailUrl(stage.id);

        actions.appendChild(link);
        body.appendChild(actions);
        bottom.appendChild(body);

        details.appendChild(summary);
        details.appendChild(bottom);

        details.addEventListener("toggle", () => {
            if (!details.isConnected) return;

            if (details.open) {
                expandedStages.add(stage.id);
            } else {
                expandedStages.delete(stage.id);
            }
        });

        return details;
    }

    /* =====================================================
       12. HIỂN THỊ DASHBOARD
       ===================================================== */

    function renderDashboard() {
        const empty = byId("progress-empty");
        const dashboard = byId("progress-dashboard");

        if (!empty || !dashboard) return;

        const data = getProgressData();
        const sourceBadge = byId("ep-data-source");

        if (!data) {
            empty.hidden = false;
            dashboard.hidden = true;

            if (sourceBadge) {
                sourceBadge.textContent =
                    "Chưa có lộ trình";
            }

            return;
        }

        empty.hidden = true;
        dashboard.hidden = false;

        const stats = getOverallStats(data);

        byId("ep-overall-percent").textContent =
            `${stats.percentage}%`;

        byId("ep-overall-caption").textContent =
            `${stats.completed}/${stats.total} nhiệm vụ`;

        byId("ep-completed-count").textContent =
            String(stats.completed);

        byId("ep-remaining-caption").textContent =
            `${stats.remaining} nhiệm vụ còn lại`;

        byId("ep-phase-count").textContent =
            String(data.stages.length);

        byId("ep-phase-caption").textContent =
            `${stats.completedStages} giai đoạn đã hoàn thành`;

        byId("ep-overall-bar").style.width =
            `${stats.percentage}%`;

        byId("ep-overall-progress").setAttribute(
            "aria-valuenow",
            String(stats.percentage)
        );

        byId("ep-roadmap-count").textContent =
            `${data.stages.length} giai đoạn`;

        const isSynced = data.source === "synced";

        if (sourceBadge) {
            sourceBadge.textContent = isSynced
                ? "Lộ trình từ Tư vấn"
                : "Dữ liệu minh họa";
        }

        byId("ep-goal-title").textContent = isSynced
            ? "Hoàn thành lộ trình"
            : "Đạt GPA 3,2/4,0";

        byId("ep-goal-description").textContent =
            isSynced
                ? "Hoàn thành các nhiệm vụ đã thêm " +
                  "từ trang Tư vấn."
                : "Mục tiêu minh họa: " +
                  "cuối năm học 2026–2027.";

        byId("ep-goal-status").textContent =
            stats.percentage === 100
                ? "Đã hoàn thành"
                : "Đang theo đuổi";

        const next = getNextTask(data);
        const nextLink = byId("ep-next-link");

        if (next) {
            byId("ep-next-task").textContent =
                next.task.text;

            byId("ep-next-phase").textContent =
                `${next.stage.subtitle} · ${next.stage.title}`;

            nextLink.href = detailUrl(
                next.stage.id,
                next.task.id
            );

            nextLink.textContent =
                "Học nhiệm vụ này →";

        } else {
            byId("ep-next-task").textContent =
                "Bạn đã hoàn thành toàn bộ nhiệm vụ!";

            byId("ep-next-phase").textContent =
                "Bạn có thể đánh giá lại năng lực " +
                "ở trang Tư vấn.";

            nextLink.href =
                "advising-contact.html?state=3";

            nextLink.textContent =
                "Mở trang Tư vấn →";
        }

        if (!accordionInitialized) {
            const defaultStage = next
                ? next.stage
                : data.stages[0];

            if (defaultStage) {
                expandedStages.add(defaultStage.id);
            }

            accordionInitialized = true;
        }

        const stageList = byId("ep-stage-list");
        stageList.replaceChildren();

        data.stages.forEach((stage, index) => {
            stageList.appendChild(
                createStageCard(stage, index, data)
            );
        });
    }

    /* =====================================================
       13. HIỂN THỊ TRANG CHI TIẾT
       ===================================================== */

    function renderDetail() {
        const root = byId("ep-detail-content");
        if (!root) return;

        const data = getProgressData();

        root.replaceChildren();

        if (!data) {
            const empty = createElement(
                "section",
                "ep-panel ep-empty-content"
            );

            empty.appendChild(
                createElement(
                    "h2",
                    "",
                    "Bạn chưa có lộ trình học tập"
                )
            );

            const link = createElement(
                "a",
                "ep-button ep-button-primary",
                "Đến trang Tư vấn"
            );

            link.href =
                "advising-contact.html?state=3";

            empty.appendChild(link);
            root.appendChild(empty);

            return;
        }

        const requestedPhase = params.get("phase");

        let stageIndex = data.stages.findIndex(
            stage => stage.id === requestedPhase
        );

        if (stageIndex < 0) {
            const next = getNextTask(data);

            stageIndex = next
                ? data.stages.findIndex(
                    stage => stage.id === next.stage.id
                )
                : 0;
        }

        const stage = data.stages[stageIndex];

        if (!stage) return;

        // Nếu điều hướng từ dashboard kèm task,
        // tự mở đúng tài liệu nhiệm vụ đó.
        if (!initializedLearningFromUrl) {
            const requestedTask = params.get("task");

            const matchedTask = stage.tasks.find(
                task => task.id === requestedTask
            );

            if (matchedTask) {
                activeLearningKey = getTaskKey(
                    stage.id,
                    matchedTask.id
                );
            }

            initializedLearningFromUrl = true;
        }

        const stats = getStageStats(stage);

        const layout = createElement(
            "div",
            "ep-detail-layout"
        );

        /* CỘT TRÁI */
        const content = createElement(
            "section",
            "ep-panel ep-detail-main"
        );

        const heading = createElement(
            "div",
            "ep-detail-heading"
        );

        heading.appendChild(
            createElement(
                "span",
                "ep-stage-number",
                String(stageIndex + 1)
            )
        );

        const headingText = createElement("div");

        headingText.appendChild(
            createElement(
                "h1",
                "",
                `Giai đoạn ${stageIndex + 1}: ${stage.title}`
            )
        );

        headingText.appendChild(
            createElement(
                "p",
                "ep-detail-subtitle",
                stage.subtitle
            )
        );

        heading.appendChild(headingText);
        content.appendChild(heading);

        content.appendChild(
            createElement(
                "p",
                "ep-detail-description",
                stage.description
            )
        );

        const progressInfo = createElement(
            "div",
            "ep-detail-progress-info"
        );

        progressInfo.appendChild(
            createElement(
                "span",
                "",
                "Tiến độ giai đoạn"
            )
        );

        progressInfo.appendChild(
            createElement(
                "strong",
                "",
                `${stats.percentage}%`
            )
        );

        content.appendChild(progressInfo);

        content.appendChild(
            createProgressBar(
                stats.percentage,
                "Tiến độ của giai đoạn đang xem"
            )
        );

        content.appendChild(
            createElement(
                "h2",
                "ep-detail-task-heading",
                "Danh sách nhiệm vụ và tài liệu"
            )
        );

        content.appendChild(
            createElement(
                "p",
                "ep-detail-description",
                "Bấm vào tên nhiệm vụ để mở tài liệu. " +
                "Chỉ tích vào ô vuông để cập nhật hoàn thành."
            )
        );

        content.appendChild(
            createTaskList(stage, data, true)
        );

        /* NÚT CHUYỂN GIAI ĐOẠN */
        const navigation = createElement(
            "nav",
            "ep-detail-navigation"
        );

        navigation.setAttribute(
            "aria-label",
            "Chuyển giai đoạn"
        );

        if (stageIndex > 0) {
            const previous = createElement(
                "a",
                "ep-button ep-button-secondary",
                "← Giai đoạn trước"
            );

            previous.href = detailUrl(
                data.stages[stageIndex - 1].id
            );

            navigation.appendChild(previous);
        }

        if (stageIndex < data.stages.length - 1) {
            const next = createElement(
                "a",
                "ep-button ep-button-primary",
                "Giai đoạn tiếp →"
            );

            next.href = detailUrl(
                data.stages[stageIndex + 1].id
            );

            navigation.appendChild(next);
        }

        content.appendChild(navigation);

        /* CỘT PHẢI */
        const aside = createElement(
            "aside",
            "ep-detail-aside"
        );

        const summary = createElement(
            "section",
            "ep-panel"
        );

        summary.appendChild(
            createElement(
                "h2",
                "ep-detail-task-heading",
                "Tổng quan giai đoạn"
            )
        );

        summary.appendChild(
            createElement(
                "strong",
                "ep-detail-big-number",
                `${stats.percentage}%`
            )
        );

        summary.appendChild(
            createElement(
                "p",
                "ep-side-description",
                `${stats.completed}/${stats.total} nhiệm vụ ` +
                "đã hoàn thành"
            )
        );

        summary.appendChild(
            createStatusBadge(stage)
        );

        const remaining = createElement(
            "section",
            "ep-panel"
        );

        remaining.appendChild(
            createElement(
                "h2",
                "ep-detail-task-heading",
                "Nhiệm vụ còn lại"
            )
        );

        remaining.appendChild(
            createElement(
                "strong",
                "ep-detail-big-number",
                String(stats.remaining)
            )
        );

        remaining.appendChild(
            createElement(
                "p",
                "ep-side-description",
                "Tài liệu và gợi ý đáp án giúp bạn " +
                "tự học. Chỉ checkbox mới cập nhật tiến độ."
            )
        );

        aside.appendChild(summary);
        aside.appendChild(remaining);

        layout.appendChild(content);
        layout.appendChild(aside);

        root.appendChild(layout);
    }

    /* =====================================================
       14. CLICK VÀO TÊN NHIỆM VỤ
       CHỈ MỞ / ĐÓNG TÀI LIỆU
       KHÔNG THAY ĐỔI CHECKBOX
       ===================================================== */

    main.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const taskButton = target.closest(
            ".ep-task-open"
        );

        if (taskButton) {
            const wasExpanded =
                taskButton.getAttribute(
                    "aria-expanded"
                ) === "true";

            // Thu gọn toàn bộ tài liệu đang mở.
            main.querySelectorAll(
                ".ep-task-open"
            ).forEach(button => {
                button.setAttribute(
                    "aria-expanded",
                    "false"
                );

                const hint = button.querySelector(
                    ".ep-task-action"
                );

                if (hint) {
                    hint.textContent =
                        "Xem tài liệu ▾";
                }
            });

            main.querySelectorAll(
                ".ep-learning-panel"
            ).forEach(panel => {
                panel.hidden = true;
            });

            main.querySelectorAll(
                ".ep-task-item"
            ).forEach(item => {
                item.classList.remove("is-open");
            });

            if (wasExpanded) {
                activeLearningKey = null;
                return;
            }

            const panelId = taskButton.getAttribute(
                "aria-controls"
            );

            const panel = byId(panelId);

            if (!panel) return;

            panel.hidden = false;

            taskButton.setAttribute(
                "aria-expanded",
                "true"
            );

            const hint = taskButton.querySelector(
                ".ep-task-action"
            );

            if (hint) {
                hint.textContent = "Thu gọn ▲";
            }

            taskButton.closest(
                ".ep-task-item"
            ).classList.add("is-open");

            activeLearningKey =
                taskButton.dataset.taskKey;

            // Không gọi saveTaskState tại đây.
            return;
        }

        /* XEM GỢI Ý ĐÁP ÁN */
        const answerButton = target.closest(
            ".ep-answer-toggle"
        );

        if (answerButton) {
            const answerId =
                answerButton.getAttribute(
                    "aria-controls"
                );

            const answer = byId(answerId);

            if (!answer) return;

            const willOpen = answer.hidden;

            answer.hidden = !willOpen;

            answerButton.setAttribute(
                "aria-expanded",
                String(willOpen)
            );

            answerButton.textContent = willOpen
                ? "Ẩn gợi ý đáp án ▴"
                : "Xem gợi ý đáp án ▾";

            // Xem đáp án không làm nhiệm vụ hoàn thành.
        }
    });

    /* =====================================================
       15. CHỈ CHECKBOX MỚI CẬP NHẬT TIẾN ĐỘ
       ===================================================== */

    main.addEventListener("change", event => {
        const checkbox = event.target;

        if (
            !(checkbox instanceof HTMLInputElement) ||
            !checkbox.classList.contains(
                "ep-task-check"
            )
        ) {
            return;
        }

        const stageId = checkbox.dataset.stageId;
        const taskId = checkbox.dataset.taskId;

        const data = getProgressData();

        if (!data) return;

        const saved = saveTaskState(
            data,
            stageId,
            taskId,
            checkbox.checked
        );

        if (!saved) {
            checkbox.checked = !checkbox.checked;

            const status = byId("ep-live-status");

            if (status) {
                status.textContent =
                    "Không lưu được tiến độ. " +
                    "Hãy kiểm tra bộ nhớ trình duyệt.";
            }

            return;
        }

        if (PAGE === "dashboard") {
            renderDashboard();
        } else {
            renderDetail();
        }

        // Giữ vị trí thao tác trên checkbox.
        const newCheckbox = Array.from(
            main.querySelectorAll(
                ".ep-task-check"
            )
        ).find(item =>
            item.dataset.stageId === stageId &&
            item.dataset.taskId === taskId
        );

        if (newCheckbox) {
            newCheckbox.focus({
                preventScroll: true
            });
        }
    });

    /* =====================================================
       16. KHỞI TẠO
       ===================================================== */

    if (PAGE === "dashboard") {
        renderDashboard();
    }

    if (PAGE === "detail") {
        renderDetail();
    }

    /* =====================================================
       17. ĐỒNG BỘ KHI DỮ LIỆU ĐỔI Ở TAB KHÁC
       ===================================================== */

    window.addEventListener("storage", event => {
        if (
            event.key !== DEMO_KEY &&
            event.key !== SYNC_KEY
        ) {
            return;
        }

        if (PAGE === "dashboard") {
            renderDashboard();
        } else if (PAGE === "detail") {
            renderDetail();
        }
    });

});
