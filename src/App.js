import { Button } from "primereact/button";

import "../src/App.css";
import ReactDataTable from "./Components/ReactDataTable";
import { useState } from "react";
import Modal from "./Components/Modal";
import * as ExcelJS from "exceljs";

import { saveAs } from "file-saver"; // Import file-saver to save the file

function App() {
  const [visible, setVisible] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [selectedTaxCode, setSelectedTaxCode] = useState(null); // Thêm state để lưu mã số thuế đã chọn
  const [reportType, setReportType] = useState("theo-bien-so-xe"); // State để quản lý loại báo cáo

  const handleInvoices = (invoicesData, taxCode, reportType) => {
    // Cập nhật để nhận thêm taxCode và reportType
    setInvoices(invoicesData);
    setSelectedTaxCode(taxCode); // Lưu mã số thuế đã chọn
    setReportType(reportType); // Lưu loại báo cáo đã chọn
  };

  // Function để xác định tuyến dựa trên mã số thuế và ký hiệu
  const getTuyenBySeries = (taxCode, series) => {
    // Sử dụng taxCode được truyền vào từ ReactDataTable
    if (!taxCode) {
      console.log("getTuyenBySeries - Không có mã số thuế");
      return "Không có MST";
    }

    const tuyens = {
      3500676761: {
        "5C25MHM": "BX Vũng Tàu - BX Miền Tây",
        "5C25MBT": "BX Bà Rịa - BX Miền Tây",
        "5C25MAD": "BX Vũng Tàu - BX Miền Tây",
        "5C25MAC": "BX Bà Rịa - BX Miền Tây",
        "5C25MAB": "BX. VŨNG TÀU - BX. MIỀN ĐÔNG",
        "5C25MAA": "Phường Vũng Tàu - Phường Bến Thành",
      },
      "3500676761-001": {
        "5C25MHM": "BX Miền Tây - BX Vũng Tàu",
        "5C25MBT": "BX Miền Tây - BX Bà Rịa",
        "5C25MAD": "BX Miền Tây - BX Vũng Tây",
        "5C25MAC": "BX Miền Tây - BX Bà Rịa",
        "5C25MAB": "BX. MIỀN ĐÔNG - BX. VŨNG TÀU",
        "5C25MAA": "Phường Bến Thành - Phường Vũng Tàu",
      },
    };

    // Debug log để kiểm tra
    console.log("getTuyenBySeries - taxCode:", taxCode, "series:", series);

    // Chỉ xử lý 2 mã số thuế được định nghĩa
    if (!tuyens[taxCode]) {
      console.log("getTuyenBySeries - Mã số thuế không được hỗ trợ:", taxCode);
      return "Không xác định";
    }

    const result = tuyens[taxCode]?.[series];
    console.log("getTuyenBySeries - result:", result);

    return result || "Không xác định";
  };

  const flattenedInvoices = (invoices || []).flatMap((invoice) => {
    // Kiểm tra nếu invoice.details tồn tại và là mảng
    if (invoice && invoice.details && Array.isArray(invoice.details)) {
      return invoice.details.map((detail) => ({
        ...invoice, // Thêm thông tin hóa đơn vào chi tiết
        ...detail, // Gộp thông tin chi tiết
      }));
    }
    // Nếu không có details, trả về invoice gốc
    return [invoice];
  });

  // Xử lý dữ liệu dựa trên loại báo cáo
  let groupedInvoices = {};

  if (reportType === "tong-hop-tem-ve") {
    // Báo cáo tổng hợp tem, vé: Group by Ký hiệu + Ngày
    groupedInvoices = flattenedInvoices.reduce((groups, invoice) => {
      const key = `${invoice.inv_invoiceSeries || ""}_${
        invoice.inv_invoiceIssuedDate || ""
      }`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(invoice);
      return groups;
    }, {});
  } else {
    // Báo cáo theo biển số xe: Group by ký hiệu, ngày và biển số xe
    groupedInvoices = flattenedInvoices.reduce((groups, invoice) => {
      // Tạo key duy nhất từ 3 trường: ký hiệu + ngày + biển số xe
      const key = `${invoice.inv_invoiceSeries || ""}_${
        invoice.inv_invoiceIssuedDate || ""
      }_${invoice.inv_departureDate || "Không có biển số"}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(invoice);
      return groups;
    }, {});
  }

  // Debug log để kiểm tra
  console.log("Loại báo cáo:", reportType);
  console.log("Số lượng dòng gốc:", flattenedInvoices.length);
  console.log(
    "Số lượng nhóm sau khi group:",
    Object.keys(groupedInvoices).length
  );
  console.log("Các nhóm:", Object.keys(groupedInvoices).slice(0, 5));

  // Gộp các dòng theo logic tương ứng với loại báo cáo
  const mergedInvoices = Object.keys(groupedInvoices)
    .sort((a, b) => {
      // Sắp xếp theo key để giữ thứ tự logic
      return a.localeCompare(b);
    })
    .map((key) => {
      const invoicesInGroup = groupedInvoices[key];

      // Lấy thông tin từ dòng đầu tiên của nhóm
      const firstInvoice = invoicesInGroup[0];

      // Cộng dồn các cột số liệu
      const totalQuantity = invoicesInGroup.reduce(
        (sum, inv) => sum + (Number(inv.inv_quantity) || 0),
        0
      );
      const totalBeforeTax = invoicesInGroup.reduce(
        (sum, inv) => sum + (Number(inv.inv_TotalAmountWithoutVat) || 0),
        0
      );
      const totalTax = invoicesInGroup.reduce(
        (sum, inv) => sum + (Number(inv.inv_vatAmount) || 0),
        0
      );
      const totalAmount = invoicesInGroup.reduce(
        (sum, inv) => sum + (Number(inv.inv_TotalAmount) || 0),
        0
      );

      // Tạo dòng gộp với thông tin tổng hợp
      return {
        ...firstInvoice,
        inv_quantity: totalQuantity,
        inv_TotalAmountWithoutVat: totalBeforeTax,
        inv_vatAmount: totalTax,
        inv_TotalAmount: totalAmount,
        // Thêm thông tin về số lượng dòng gộp cho báo cáo tổng hợp tem, vé
        ...(reportType === "tong-hop-tem-ve" && {
          _groupCount: invoicesInGroup.length,
        }),
      };
    });

  // Debug log để kiểm tra kết quả
  console.log("Số lượng dòng sau khi merge:", mergedInvoices.length);
  console.log(
    "Mẫu dữ liệu sau khi merge:",
    mergedInvoices.slice(0, 3).map((item) => ({
      series: item.inv_invoiceSeries,
      date: item.inv_invoiceIssuedDate,
      bienSo: item.inv_departureDate,
      quantity: item.inv_quantity,
      groupCount: item._groupCount,
    }))
  );
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("bao-cao-chi-tiet");

    // Thêm tiêu đề - khác nhau tùy theo loại báo cáo
    const headers =
      reportType === "tong-hop-tem-ve"
        ? [
            "Ký Hiệu",
            "Ngày Hóa Đơn",
            "Tên hàng",
            "Số lượng",
            "Đơn giá",
            "Tiền trước thuế",
            "Tiền Thuế",
            "Thành tiền",
            "Ghi chú",
          ]
        : [
            "Ký Hiệu",
            "Tuyến",
            "Ngày Hóa Đơn",
            "Biển số xe",
            "Tên hàng",
            "Số lượng",
            "Đơn giá",
            "Tiền trước thuế",
            "Tiền Thuế",
            "Thành tiền",
            "Ghi chú",
          ];
    worksheet.addRow(headers);

    // Áp dụng style cho tiêu đề
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0070C0" },
    };
    headerRow.alignment = { horizontal: "center" };

    // Thêm viền cho tiêu đề
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    // Thêm dữ liệu - khác nhau tùy theo loại báo cáo
    mergedInvoices.forEach((row) => {
      if (reportType === "tong-hop-tem-ve") {
        // Báo cáo tổng hợp tem, vé: Không có Tuyến và Biển số xe
        const dataRow = worksheet.addRow([
          row.inv_invoiceSeries || "",
          row.inv_invoiceIssuedDate
            ? new Date(row.inv_invoiceIssuedDate).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
          row.inv_itemName || "",
          row.inv_quantity ? Number(row.inv_quantity) : "",
          row.inv_unitPrice ? Number(row.inv_unitPrice) : "",
          row.inv_TotalAmountWithoutVat
            ? Number(row.inv_TotalAmountWithoutVat)
            : "",
          row.inv_vatAmount ? Number(row.inv_vatAmount) : "",
          row.inv_TotalAmount ? Number(row.inv_TotalAmount) : "",
          row.ghi_chu || "",
        ]);
      } else {
        // Báo cáo theo biển số xe: Có đầy đủ các cột
        const dataRow = worksheet.addRow([
          row.inv_invoiceSeries || "",
          getTuyenBySeries(
            row.inv_buyerTaxCode || "3500676761",
            row.inv_invoiceSeries
          ) || "",
          row.inv_invoiceIssuedDate
            ? new Date(row.inv_invoiceIssuedDate).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
          row.inv_departureDate || "",
          row.inv_itemName || "",
          row.inv_quantity ? Number(row.inv_quantity) : "",
          row.inv_unitPrice ? Number(row.inv_unitPrice) : "",
          row.inv_TotalAmountWithoutVat
            ? Number(row.inv_TotalAmountWithoutVat)
            : "",
          row.inv_vatAmount ? Number(row.inv_vatAmount) : "",
          row.inv_TotalAmount ? Number(row.inv_TotalAmount) : "",
          row.ghi_chu || "",
        ]);
      }

      // Thêm viền cho từng ô dữ liệu
      const currentRow =
        reportType === "tong-hop-tem-ve"
          ? worksheet.getRow(worksheet.rowCount)
          : worksheet.getRow(worksheet.rowCount);

      currentRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
      });
    });

    // Tính tổng các cột cần tính
    const totalSoLuong = mergedInvoices.reduce(
      (sum, row) => sum + (row.inv_quantity || 0),
      0
    );
    const totalTruocThue = mergedInvoices.reduce(
      (sum, row) => sum + (row.inv_TotalAmountWithoutVat || 0),
      0
    );
    const totalThue = mergedInvoices.reduce(
      (sum, row) => sum + (row.inv_vatAmount || 0),
      0
    );
    const totalThanhTien = mergedInvoices.reduce(
      (sum, row) => sum + (row.inv_TotalAmount || 0),
      0
    );

    // Thêm dòng tổng cộng - khác nhau tùy theo loại báo cáo
    const totalRow =
      reportType === "tong-hop-tem-ve"
        ? [
            "Tổng cộng",
            "",
            "",
            totalSoLuong,
            "",
            totalTruocThue,
            totalThue,
            totalThanhTien,
            "",
          ]
        : [
            "Tổng cộng",
            "",
            "",
            "",
            "",
            totalSoLuong,
            "",
            totalTruocThue,
            totalThue,
            totalThanhTien,
            "",
          ];
    const lastRow = worksheet.addRow(totalRow);

    // Định dạng dòng tổng cộng
    lastRow.font = { bold: true, color: { argb: "FF000000" } };
    lastRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFCCCCCC" },
    };
    lastRow.alignment = { horizontal: "right" };

    // Thêm viền cho dòng tổng cộng
    lastRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    // Lưu file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, "bao-cao-chi-tiet.xlsx");
  };

  return (
    <div className="container">
      {/* item button menu */}
      <div
        style={{
          backgroundColor: "#F8F9FA",
          borderWidth: "0.1px",
          borderColor: "#DEE2E6",
        }}
        className="flex col h-3rem  border-solid mr-3 ml-3 mt-3 border-round-sm"
      >
        <Button
          label="Lọc dữ liệu"
          className="w-1 min-h-full border-solid border-1 border-round-sm text-sm "
          onClick={() => setVisible(true)}
        ></Button>

        <Button
          onClick={exportToExcel}
          label="Xuất excel"
          className="w-1 min-h-full border-solid border-1 border-round-sm ml-2 text-sm "
        ></Button>
      </div>
      {/* table  */}
      <ReactDataTable
        invoices={mergedInvoices}
        getTuyenBySeries={getTuyenBySeries}
      />
      <Modal
        visible={visible}
        setVisible={setVisible}
        setInvoices={handleInvoices}
        reportType={reportType}
        setReportType={setReportType}
      ></Modal>
    </div>
  );
}

export default App;
