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
    // console.log(`=== API: Ký hiệu ${khieu} ===`);
    // console.log(`Tổng số hóa đơn: ${allData.length}`);
    // if (allData.length > 0) {
    //   console.log(
    //     `Mẫu dữ liệu (3 hóa đơn đầu):`,
    //     allData.slice(0, 3).map((item) => ({
    //       series: item.inv_invoiceSeries,
    //       number: item.inv_invoiceNumber,
    //       date: item.inv_invoiceIssuedDate,
    //       total: item.inv_TotalAmount,
    //     }))
    //   );
    // }

    return allData;
  } catch (error) {
    // console.error("Error calling API:", error.message);
    // if (error.response) console.error("Response error:", error.response.data);
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

    // console.log("API Response - Danh sách ký hiệu:", data);

    // Danh sách ký hiệu cần filter (loại bỏ)
    const excludedSeries = [];

    // Chuyển đổi dữ liệu để phù hợp với MultiSelect
    // Hiển thị tất cả ký hiệu có giá trị, nhưng loại bỏ các ký hiệu trong excludedSeries
    // Loại bỏ các ký hiệu bắt đầu bằng "1C23" hoặc "1C24"
    const result = data
      .filter(
        (item) =>
          item.value &&
          item.value.trim() !== "" &&
          !excludedSeries.includes(item.value) &&
          !item.value.startsWith("1C23") &&
          !item.value.startsWith("1C24")
      )
      .map((item) => ({
        name: item.value,
        code: item.value,
        id: item.id,
        invoiceTypeName: item.invoiceTypeName,
      }));

    // console.log("Danh sách ký hiệu sau khi xử lý:", result);
    // console.log(
    //   `Đã loại bỏ ${data.length - result.length} ký hiệu (tổng ${
    //     data.length
    //   } ký hiệu)`
    // );
    return result;
  } catch (error) {
    // console.error("Error fetching invoice series:", error.message);
    // if (error.response) console.error("Response error:", error.response.data);
    return [];
  }
};

// Số ký hiệu gọi song song tối đa. Server minvoice chậm khi gọi nhiều request
// cùng lúc (coChiTiet=true payload nặng) — thử 2 trước, có thể chỉnh 1 hoặc 3.
const SERIES_CONCURRENCY = 2;

const runWithConcurrency = async (items, concurrency, workerFn, onItemComplete) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      results[index] = await workerFn(item, index);
      if (onItemComplete) {
        onItemComplete(results[index], index + 1, items.length);
      }
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker())
  );

  return results;
};

const fetchSeriesInvoices = async (
  taxCode,
  tuNgay,
  denngay,
  khieu,
  url,
  headers,
  limit,
  fetchWithRetry
) => {
  let seriesData = [];
  let start = 0;

  while (true) {
    const body = {
      tuNgay,
      denngay,
      khieu,
      start,
      coChiTiet: true,
    };

    let resData = [];
    let success = false;

    try {
      resData = await fetchWithRetry(url, body, headers, khieu);
      success = true;
    } catch (error) {
      success = false;
    }

    if (!success) {
      start += limit;
      if (start > 10000) break;
      continue;
    }

    if (!Array.isArray(resData) || resData.length === 0) break;

    const processedData = resData.map((item) => ({
      ...item,
      inv_invoiceSeries: khieu,
      inv_buyerTaxCode: taxCode,
    }));

    seriesData.push(...processedData);

    if (resData.length < limit) break;
    start += limit;
  }

  return seriesData;
};

const getInvoicesBySeriesList = async (
  taxCode,
  tuNgay,
  denngay,
  seriesList,
  progressCallback,
  dataUpdateCallback, // Callback để cập nhật dữ liệu từng phần
  errorCallback // Callback khi gặp lỗi nghiêm trọng (để tự động xuất Excel)
) => {
  const url = `https://${taxCode}.minvoice.app/api/InvoiceApi78/GetInvoices`;

  const headers = {
    Authorization: "Bearer O87316arj5+Od3Fqyy5hzdBfIuPk73eKqpAzBSvv8sY=",
    "Content-Type": "application/json",
  };

  let allData = [];
  const limit = 300;

  // Helper function để retry API call (đặt ngoài vòng lặp để tránh linter warning)
  const fetchWithRetry = async (
    apiUrl,
    bodyParams,
    apiHeaders,
    seriesCode,
    maxRetries = 3
  ) => {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        const response = await axios.post(apiUrl, bodyParams, {
          headers: apiHeaders,
        });
        return response?.data?.data || [];
      } catch (error) {
        retryCount++;
        // console.warn(
        //   `Lỗi khi lấy dữ liệu cho ký hiệu ${seriesCode}, start=${bodyParams.start}, lần thử ${retryCount}/${maxRetries}:`,
        //   error.message
        // );

        if (retryCount >= maxRetries) {
          // console.error(
          //   `Đã thử ${maxRetries} lần nhưng vẫn lỗi. Bỏ qua batch này và tiếp tục với batch tiếp theo.`
          // );
          throw error; // Throw để bên ngoài xử lý
        }

        // Đợi một chút trước khi retry (exponential backoff)
        const delayMs = 1000 * retryCount;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return [];
  };

  try {
    // Lấy danh sách các ký hiệu đã chọn, loại bỏ các ký hiệu bắt đầu bằng "1C23" hoặc "1C24"
    const selectedSeriesCodes = seriesList
      .map((series) => series.code)
      .filter((code) => !code.startsWith("1C23") && !code.startsWith("1C24"));
    // console.log("Danh sách ký hiệu đã chọn:", selectedSeriesCodes);

    // Luôn giữ tối đa SERIES_CONCURRENCY request — xong ký hiệu nào thì gọi ký hiệu tiếp theo ngay
    await runWithConcurrency(
      selectedSeriesCodes,
      SERIES_CONCURRENCY,
      (khieu) =>
        fetchSeriesInvoices(
          taxCode,
          tuNgay,
          denngay,
          khieu,
          url,
          headers,
          limit,
          fetchWithRetry
        ),
      (seriesData, completedCount, total) => {
        if (progressCallback) {
          progressCallback(completedCount, total);
        }

        allData.push(...seriesData);

        if (dataUpdateCallback && allData.length > 0) {
          const sortedData = [...allData].sort(
            (a, b) => a.inv_invoiceNumber - b.inv_invoiceNumber
          );
          dataUpdateCallback(sortedData, taxCode);
        }
      }
    );

    // Sắp xếp lại toàn bộ dữ liệu theo số hóa đơn
    allData.sort((a, b) => a.inv_invoiceNumber - b.inv_invoiceNumber);

    // Log để debug
    // console.log("=== API: Tổng hợp tất cả ký hiệu ===");
    // console.log(`Tổng số hóa đơn: ${allData.length}`);
    // console.log(`Số ký hiệu đã xử lý: ${selectedSeriesCodes.length}`);
    // if (allData.length > 0) {
    //   console.log(
    //     "Mẫu dữ liệu (5 hóa đơn đầu):",
    //     allData.slice(0, 5).map((item) => ({
    //       series: item.inv_invoiceSeries,
    //       number: item.inv_invoiceNumber,
    //       date: item.inv_invoiceIssuedDate,
    //       total: item.inv_TotalAmount,
    //     }))
    //   );
    // }

    return allData;
  } catch (error) {
    // console.error("Error fetching invoices by series list:", error);
    // Trả về dữ liệu đã tải được thay vì mảng rỗng
    if (allData.length > 0) {
      // console.warn(
      //   `⚠️ Đã gặp lỗi nghiêm trọng nhưng vẫn trả về ${allData.length} hóa đơn đã tải được`
      // );

      // Gọi callback để thông báo lỗi nghiêm trọng (để tự động xuất Excel)
      if (errorCallback && typeof errorCallback === "function") {
        try {
          errorCallback(error, allData, taxCode);
        } catch (callbackError) {
          // console.error("Lỗi khi gọi errorCallback:", callbackError);
        }
      }

      return allData;
    }

    // Nếu không có dữ liệu và có errorCallback, vẫn gọi để thông báo
    if (errorCallback && typeof errorCallback === "function") {
      try {
        errorCallback(error, [], taxCode);
      } catch (callbackError) {
        // console.error("Lỗi khi gọi errorCallback:", callbackError);
      }
    }

    return [];
  }
};

export { getInvoiceSeries, getInvoicesBySeriesList };
export default getInvoices;
