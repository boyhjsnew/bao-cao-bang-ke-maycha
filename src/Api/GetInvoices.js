import axios from "axios";

const getInvoices = async (taxCode, tuNgay, denngay, khieu) => {
  const url = `https://${taxCode}.minvoice.app/api/InvoiceApi78/GetInvoices`;

  const headers = {
    Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
    "Content-Type": "application/json",
  };

  let allData = [];
  let start = 0;
  const limit = 300;

  try {
    while (true) {
      const body = {
        tuNgay,
        denngay,
        khieu,
        start,
        coChiTiet: true,
      };

      const response = await axios.post(url, body, { headers });
      const resData = response?.data?.data || [];

      if (!Array.isArray(resData) || resData.length === 0) break;

      // Đảm bảo ký hiệu được gán đúng cho mỗi record
      const processedData = resData.map((item) => ({
        ...item,
        inv_invoiceSeries: khieu,
        inv_buyerTaxCode: taxCode, // Đảm bảo mã số thuế được gán đúng
      }));

      allData.push(...processedData);

      if (resData.length < limit) break;
      start += limit;
    }

    allData.sort((a, b) => a.inv_invoiceNumber - b.inv_invoiceNumber);

    // Log để debug
    console.log(
      `Dữ liệu cho ký hiệu ${khieu}:`,
      allData.slice(0, 3).map((item) => ({
        series: item.inv_invoiceSeries,
        number: item.inv_invoiceNumber,
      }))
    );

    return allData;
  } catch (error) {
    console.error("Error calling API:", error.message);
    if (error.response) console.error("Response error:", error.response.data);
    return [];
  }
};

// API mới để lấy danh sách ký hiệu
const getInvoiceSeries = async (taxCode) => {
  const url = `https://${taxCode}.minvoice.app/api/Invoice68/GetTypeInvoiceSeries`;

  const headers = {
    Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(url, { headers });
    const data = response?.data?.data || [];

    // Chuyển đổi dữ liệu để phù hợp với MultiSelect
    // Chỉ lấy những ký hiệu bắt đầu từ "5C25"
    return data
      .filter((item) => item.value && item.value.startsWith("5C25"))
      .map((item) => ({
        name: item.value,
        code: item.value,
        id: item.id,
        invoiceTypeName: item.invoiceTypeName,
      }));
  } catch (error) {
    console.error("Error fetching invoice series:", error.message);
    if (error.response) console.error("Response error:", error.response.data);
    return [];
  }
};

// API mới để lấy dữ liệu theo danh sách ký hiệu
const getInvoicesBySeriesList = async (
  taxCode,
  tuNgay,
  denngay,
  seriesList,
  progressCallback
) => {
  const url = `https://${taxCode}.minvoice.app/api/InvoiceApi78/GetInvoices`;

  const headers = {
    Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
    "Content-Type": "application/json",
  };

  let allData = [];
  let start = 0;
  const limit = 300;

  try {
    // Lấy danh sách các ký hiệu đã chọn
    const selectedSeriesCodes = seriesList.map((series) => series.code);
    console.log("Danh sách ký hiệu đã chọn:", selectedSeriesCodes);

    // Gọi API cho từng ký hiệu trong danh sách
    for (let i = 0; i < selectedSeriesCodes.length; i++) {
      const khieu = selectedSeriesCodes[i];

      // Gọi callback để cập nhật tiến trình
      if (progressCallback) {
        progressCallback(i + 1, selectedSeriesCodes.length);
      }

      console.log(`Đang lấy dữ liệu cho ký hiệu: ${khieu}`);
      let start = 0;

      while (true) {
        const body = {
          tuNgay,
          denngay,
          khieu,
          start,
          coChiTiet: true,
        };

        const response = await axios.post(url, body, { headers });
        const resData = response?.data?.data || [];

        if (!Array.isArray(resData) || resData.length === 0) break;

        // Thêm ký hiệu vào mỗi record để đảm bảo mapping đúng
        const processedData = resData.map((item) => ({
          ...item,
          inv_invoiceSeries: khieu, // Đảm bảo ký hiệu được gán đúng
          inv_buyerTaxCode: taxCode, // Đảm bảo mã số thuế được gán đúng
        }));

        allData.push(...processedData);

        if (resData.length < limit) break;
        start += limit;
      }
    }

    // Sắp xếp lại toàn bộ dữ liệu theo số hóa đơn
    allData.sort((a, b) => a.inv_invoiceNumber - b.inv_invoiceNumber);

    // Log để debug
    console.log(
      "Dữ liệu sau khi xử lý:",
      allData.slice(0, 5).map((item) => ({
        series: item.inv_invoiceSeries,
        number: item.inv_invoiceNumber,
        date: item.inv_invoiceIssuedDate,
      }))
    );

    return allData;
  } catch (error) {
    console.error("Error fetching invoices by series list:", error);
    return [];
  }
};

export { getInvoiceSeries, getInvoicesBySeriesList };
export default getInvoices;
