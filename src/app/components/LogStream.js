'use client';

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const BACKEND_URL = "https://6755-2405-201-d003-d80e-fb7c-ab03-d407-b361.ngrok-free.app";

const axiosInstance = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

const socket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ["websocket", "polling"],
  withCredentials: false,
  forceNew: true,
  path: "/socket.io/",
  extraHeaders: {
    "Access-Control-Allow-Origin": "*",
  },
});

const MAX_LOGS = 100;
const INITIAL_FETCH_COUNT = 50;
const initialFilter = { startTime: "", endTime: "" };

const normalizeLogData = (data) => {
  if (typeof data === 'string') {
    return {
      log: data,
      container_name: 'N/A',
      timestamp: new Date().toISOString()
    };
  }

  return {
    log: data.log || JSON.stringify(data),
    container_name: data.container_name || 'N/A',
    timestamp: data.timestamp || new Date().toISOString()
  };
};

export default function LogStream() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleConnect = () => {
      console.log("Connected to socket server");
      setStatus("connected");
      setError(null);
    };

    const handleDisconnect = (reason) => {
      console.log("Disconnected from socket server:", reason);
      setStatus("disconnected");
    };

    const handleError = (err) => {
      console.error("Connection error:", err);
      setStatus("error");
      setError(err.message);
    };

    const handleLog = (data) => {
      console.log("Received log:", data);
      setLogs((prevLogs) => {
        const normalizedLog = normalizeLogData(data);
        const newLogs = [
          {
            id: Date.now(),
            ...normalizedLog
          },
          ...prevLogs
        ];
        return newLogs.slice(0, MAX_LOGS);
      });
    };

    socket.on("connecting", () => {
      console.log("Attempting to connect...");
    });

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);
    socket.on("error", handleError);
    socket.on("log_received", handleLog);

    if (!socket.connected) {
      console.log("Initiating connection...");
      socket.connect();
    }

    fetchInitialLogs();

    return () => {
      socket.off("connecting");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
      socket.off("error", handleError);
      socket.off("log_received", handleLog);
    };
  }, []);

  const fetchInitialLogs = async () => {
    try {
      const response = await axiosInstance.get('/logs', {
        params: { 
          limit: INITIAL_FETCH_COUNT,
        },
      });
      
      if (Array.isArray(response.data)) {
        const normalizedLogs = response.data.map(log => ({
          id: Date.now() + Math.random(),
          ...normalizeLogData(log)
        }));
        setLogs(normalizedLogs);
      } else {
        console.error("Unexpected response format:", response.data);
      }
    } catch (error) {
      console.error("Error fetching initial logs:", error);
      setError(error.message);
    }
  };

  const handleReconnect = () => {
    console.log("Manual reconnection attempt...");
    socket.disconnect();
    socket.connect();
  };

  const fetchLogs = async () => {
    setLoading(true);
  
    const params = {
      limit: MAX_LOGS,
      query: searchQuery || ''
    };
  
    if (filter.startTime) {
      params.startTime = filter.startTime;
    }
    if (filter.endTime) {
      params.endTime = filter.endTime;
    }
  
    try {
      const response = await axiosInstance.get('/logs', { params });
  
      if (Array.isArray(response.data)) {
        const normalizedLogs = response.data.map(log => ({
          id: Date.now() + Math.random(),
          ...normalizeLogData(log)
        }));
        setHistoricalLogs(normalizedLogs);
        setIsFiltering(true);
      } else {
        console.error("Unexpected response format:", response.data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleClear = () => {
    setFilter(initialFilter);
    setSearchQuery("");
    setHistoricalLogs([]);
    setIsFiltering(false);
  };

  const combinedLogs = isFiltering ? [...historicalLogs, ...logs] : logs;

  const filteredLogs = Array.isArray(combinedLogs)
  ? combinedLogs.filter((log) => {
      const formattedTimestamp = new Date(log.timestamp).toLocaleString();
      const timestampMatch = searchQuery
        ? formattedTimestamp.includes(searchQuery)
        : true;
      const logMatch = searchQuery
        ? log.log.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const containerMatch = searchQuery
        ? log.container_name.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      const timestamp = new Date(log.timestamp).getTime();
      const startMatch = filter.startTime
        ? timestamp >= new Date(filter.startTime).getTime()
        : true;
      const endMatch = filter.endTime
        ? timestamp <= new Date(filter.endTime).getTime()
        : true;

      return startMatch && endMatch && (timestampMatch || logMatch || containerMatch);
    })
  : [];


  return (
    <div className="container-fluid bg-light min-vh-100">
      <header className="bg-white shadow-sm mb-3">
        <div className="container py-4">
          <div className="d-flex justify-content-between align-items-center">
            <h1 className="display-5">Docker Logs</h1>
            <div className="d-flex align-items-center gap-3">
              <button
                className="btn btn-outline-secondary"
                onClick={handleReconnect}
              >
                Reconnect
              </button>
              <div className={`badge ${
                status === 'connected' ? 'bg-success' : 'bg-danger'
              } d-flex align-items-center gap-2`}>
                <span className={`${
                  status === 'connected' ? 'spinner-grow spinner-grow-sm' : ''
                }`}></span>
                {status === 'connected' ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="mt-4">
            <div className="row row-cols-1 row-cols-md-12 g-3 align-items-end">
              <div className="col col-md-4">
                <label htmlFor="searchQuery" className="form-label">
                  Search:
                </label>
                <input
                  type="text"
                  id="searchQuery"
                  className="form-control"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in logs..."
                />
              </div>
              <div className="col col-md-3">
                <label htmlFor="startTime" className="form-label">
                  Start Time:
                </label>
                <input
                  type="datetime-local"
                  id="startTime"
                  className="form-control"
                  value={filter.startTime}
                  onChange={(e) => setFilter({ ...filter, startTime: e.target.value })}
                />
              </div>
              <div className="col col-md-3">
                <label htmlFor="endTime" className="form-label">
                  End Time:
                </label>
                <input
                  type="datetime-local"
                  id="endTime"
                  className="form-control"
                  value={filter.endTime}
                  onChange={(e) => setFilter({ ...filter, endTime: e.target.value })}
                />
              </div>
              <div className="col col-md-2">
                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    onClick={handleSearch}
                    className="btn btn-primary flex-fill"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      'Search'
                    )}
                  </button>
                  <button 
                    type="button"
                    className="btn btn-secondary flex-fill" 
                    onClick={handleClear}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </header>

      <main className="container">
        <div className="bg-white shadow-sm p-4 rounded">
          {filteredLogs.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th style={{ width: '200px' }}>Timestamp</th>
                    <th style={{ width: '150px' }}>Container</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id || index}>
                      <td className="text-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="text-nowrap">
                        {log.container_name}
                      </td>
                      <td style={{ wordBreak: 'break-all' }}>
                        {log.log}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted">
              {status === 'connected' ? 'No logs found.' : 'Waiting for connection...'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}