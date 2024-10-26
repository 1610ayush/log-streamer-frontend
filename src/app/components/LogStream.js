"use client";

import React, { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("https://c522-2405-201-d003-d80e-1149-5dc0-5454-a335.ngrok-free.app", {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

const MAX_LOGS = 1000;
const INITIAL_FETCH_COUNT = 50;

const initialFilter = { startTime: "", endTime: "" };

export default function LogStream() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const addLog = useCallback((logData) => {
    setLogs((prevLogs) => {
      const newLogs = [logData, ...prevLogs];
      return newLogs.slice(0, MAX_LOGS);
    });
  }, []);

  useEffect(() => {
    const fetchInitialLogs = async () => {
      try {
        const response = await axios.get("https://c522-2405-201-d003-d80e-1149-5dc0-5454-a335.ngrok-free.app/logs", {
          params: {
            limit: INITIAL_FETCH_COUNT,
          },
        });
        setLogs(response.data.reverse());
      } catch (error) {
        console.error("Error fetching initial logs:", error);
      }
    };

    fetchInitialLogs();
  }, []);

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("log", addLog);

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("log");
    };
  }, [addLog]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get("https://c522-2405-201-d003-d80e-1149-5dc0-5454-a335.ngrok-free.app/logs", {
        params: {
          startTime: filter.startTime,
          endTime: filter.endTime,
          searchQuery: searchQuery,
        },
      });
      setHistoricalLogs(response.data);
      setIsFiltering(true);
    } catch (error) {
      console.error("Error fetching logs:", error);
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

  const combinedLogs = isFiltering ? [...logs, ...historicalLogs] : logs;

  const filteredLogs = combinedLogs.filter((log) => {
    const timestamp = new Date(log.timestamp).getTime();
    const startMatch = filter.startTime
      ? timestamp >= new Date(filter.startTime).getTime()
      : true;
    const endMatch = filter.endTime
      ? timestamp <= new Date(filter.endTime).getTime()
      : true;
    const searchMatch = searchQuery
      ? log.log.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return startMatch && endMatch && searchMatch;
  });

  return (
    <div className="container-fluid bg-light min-vh-100">
      <header className="bg-white shadow-sm mb-3">
        <div className="container py-4">
          <h1 className="display-5">Docker Logs</h1>
          <div className="row mt-4">
            <div className="col-md-3 mb-2">
              <label htmlFor="searchQuery" className="form-label">
                Search:
              </label>
              <input
                type="text"
                id="searchQuery"
                className="form-control"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="col-md-3 mb-2">
              <label htmlFor="startTime" className="form-label">
                Start Time:
              </label>
              <input
                type="datetime-local"
                id="startTime"
                className="form-control"
                value={filter.startTime}
                onChange={(e) =>
                  setFilter({ ...filter, startTime: e.target.value })
                }
              />
            </div>
            <div className="col-md-3 mb-2">
              <label htmlFor="endTime" className="form-label">
                End Time:
              </label>
              <input
                type="datetime-local"
                id="endTime"
                className="form-control"
                value={filter.endTime}
                onChange={(e) =>
                  setFilter({ ...filter, endTime: e.target.value })
                }
              />
            </div>
            <div className="col-md-1 d-flex align-items-end mb-2">
              <button
                className="btn btn-primary w-100"
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </button>
            </div>
            <div className="col-md-1 d-flex align-items-end mb-2">
              <button className="btn btn-secondary w-100" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="bg-white shadow-sm p-4 rounded">
          {filteredLogs.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={index}>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>{log.log}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted">No logs found.</p>
          )}
        </div>
      </main>
    </div>
  );
}
